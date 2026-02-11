#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execCommand } from "./lib/exec-runner.js";
import { parseCodexOutput } from "./lib/codex-output-parser.js";
import { buildExplainCodePrompt, buildPlanPerfPrompt } from "./lib/prompt-builder.js";
import { createProgressReporter, logger, setMcpServer } from "./lib/logger.js";
import type { ProgressReporter } from "./lib/logger.js";
import { CODEX_MODELS } from "./lib/types.js";
import type { CodexResult } from "./lib/types.js";

const server = new McpServer(
  { name: "codex-bridge", version: "0.1.0" },
  { capabilities: { logging: {} } },
);
setMcpServer(server);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reportCodexEvent(line: string, progress: ProgressReporter): void {
  if (!line.trim()) return;
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    const type = event["type"] as string | undefined;
    if (!type) return;
    const item = (event["item"] as Record<string, unknown>) ?? null;
    const itemType = (item?.["type"] as string) ?? (event["itemType"] as string) ?? "";
    if (!itemType) {
      progress.report(type);
      return;
    }
    // Extract a meaningful value based on the item type.
    let detail = "";
    if (itemType === "command_execution") {
      detail = (item?.["command"] as string) ?? (event["command"] as string) ?? "";
    } else if (itemType === "file_change") {
      const kind = (item?.["kind"] as string) ?? (event["kind"] as string) ?? "";
      const path = (item?.["path"] as string) ?? (event["path"] as string) ?? "";
      detail = kind && path ? `${kind} ${path}` : path || kind;
    } else if (itemType === "agent_message" || itemType === "message") {
      const msg =
        (item?.["text"] as string) ??
        (event["text"] as string) ??
        (item?.["content"] as string) ??
        (event["content"] as string) ??
        "";
      detail = msg.length > 80 ? msg.slice(0, 80) + "..." : msg;
    }
    progress.report(detail ? `${itemType}: ${detail}` : itemType);
  } catch {
    // Not valid JSON — skip.
  }
}

async function runCodex(
  prompt: string,
  options: {
    workingDirectory?: string;
    model?: string;
    sandbox?: string;
    fullAuto?: boolean;
    progress?: ProgressReporter;
  } = {},
): Promise<CodexResult> {
  const args = ["exec", "--json"];
  if (options.model) args.push("--model", options.model);
  if (options.sandbox) args.push("--sandbox", options.sandbox);
  if (options.fullAuto) args.push("--full-auto");
  args.push(prompt);

  options.progress?.report("Starting codex...");

  // Buffer for partial JSONL lines split across stdout chunks.
  let stdoutBuf = "";

  const result = await execCommand({
    command: "codex",
    args,
    cwd: options.workingDirectory,
    onStdout: (chunk) => {
      const text = chunk.toString();

      // Parse streaming JSONL events for inline progress.
      if (options.progress) {
        stdoutBuf += text;
        const lines = stdoutBuf.split(/\r?\n|\r/);
        stdoutBuf = lines.pop()!;
        for (const line of lines) {
          reportCodexEvent(line, options.progress);
        }
      }
    },
    onStderr: (chunk) => {
      logger.warn(`[codex:stderr] ${chunk.toString().replace(/\n$/, "")}`);
    },
  });

  // Flush any remaining buffered JSONL fragment.
  if (options.progress && stdoutBuf.trim()) {
    reportCodexEvent(stdoutBuf, options.progress);
  }

  if (result.timedOut) {
    return {
      threadId: null,
      agentMessage: "",
      fileChanges: [],
      commandsExecuted: [],
      usage: null,
      errors: ["Codex timed out. Increase BRIDGE_TIMEOUT_MS if needed."],
    };
  }

  options.progress?.report("Parsing response...");
  const parsed = parseCodexOutput(result.stdout);

  // Check stderr for API key issues
  if (result.exitCode !== 0 && !parsed.agentMessage) {
    const stderr = result.stderr.toLowerCase();
    if (
      stderr.includes("api key") ||
      stderr.includes("authentication") ||
      stderr.includes("unauthorized")
    ) {
      parsed.errors.push("Codex API key issue. Ensure OPENAI_API_KEY is set.");
    } else if (result.stderr.trim()) {
      parsed.errors.push(result.stderr.trim());
    }
  }

  return parsed;
}

// Safety limit to prevent exceeding MCP response token limits.
const MAX_RESPONSE_CHARS = 80_000;

function formatCodexResponse(parsed: CodexResult): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  if (parsed.errors.length > 0 && !parsed.agentMessage) {
    return {
      content: [{ type: "text" as const, text: `Error: ${parsed.errors.join("; ")}` }],
      isError: true,
    };
  }

  let text = parsed.agentMessage;

  if (parsed.fileChanges.length > 0) {
    text += "\n\n**Files changed:**\n";
    for (const fc of parsed.fileChanges) {
      text += `- ${fc.kind}: ${fc.path}\n`;
    }
  }

  if (parsed.commandsExecuted.length > 0) {
    text += "\n\n**Commands executed:**\n";
    for (const cmd of parsed.commandsExecuted) {
      text += `- \`${cmd.command}\` (exit: ${cmd.exitCode})\n`;
    }
  }

  if (text.length > MAX_RESPONSE_CHARS) {
    text = text.slice(0, MAX_RESPONSE_CHARS) + "\n\n...[response truncated]";
  }

  return { content: [{ type: "text" as const, text }] };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.registerTool(
  "codex_query",
  {
    title: "Ask Codex",
    description:
      "Ask OpenAI Codex a question or give it a task. Use for getting a second opinion, exploring unfamiliar code, or tasks that benefit from a different model's perspective.",
    inputSchema: {
      prompt: z.string().describe("The question or task for Codex"),
      workingDirectory: z
        .string()
        .optional()
        .describe("Working directory (defaults to server cwd)"),
      model: z.enum(CODEX_MODELS).optional().describe("Override the Codex model"),
      sandbox: z
        .enum(["read-only", "workspace-write", "danger-full-access"])
        .optional()
        .default("read-only")
        .describe("Sandbox level controlling what Codex can modify"),
    },
  },
  async ({ prompt, workingDirectory, model, sandbox }, extra) => {
    const progress = createProgressReporter(extra.sendNotification, extra._meta?.progressToken);
    const parsed = await runCodex(prompt, { workingDirectory, model, sandbox, progress });
    return formatCodexResponse(parsed);
  },
);

server.registerTool(
  "codex_review_code",
  {
    title: "Codex Code Review",
    description:
      "Ask Codex to review code. Provide a git diff range, file paths, or a code snippet. Returns specific, actionable feedback.",
    inputSchema: {
      target: z
        .string()
        .describe(
          'What to review: git diff range (e.g., "HEAD~3..HEAD"), file paths, or code snippet',
        ),
      focusAreas: z
        .string()
        .optional()
        .describe("Focus on: bugs, performance, style, security, etc."),
      context: z.string().optional().describe("Additional context about the codebase or changes"),
      workingDirectory: z.string().optional(),
    },
  },
  async ({ target, focusAreas, context, workingDirectory }, extra) => {
    const progress = createProgressReporter(extra.sendNotification, extra._meta?.progressToken);
    let prompt = `Review the following code changes. Provide specific, actionable feedback with line references.\n\nTarget: ${target}`;
    if (focusAreas) prompt += `\n\nFocus areas: ${focusAreas}`;
    if (context) prompt += `\n\nContext: ${context}`;

    const parsed = await runCodex(prompt, { workingDirectory, sandbox: "read-only", progress });
    return formatCodexResponse(parsed);
  },
);

server.registerTool(
  "codex_review_plan",
  {
    title: "Codex Plan Review",
    description:
      "Ask Codex to critique an implementation plan. Identifies gaps, risks, missing edge cases, and suggests improvements.",
    inputSchema: {
      plan: z.string().describe("The implementation plan or design to review"),
      codebasePath: z.string().optional().describe("Path to relevant codebase for context"),
      constraints: z
        .string()
        .optional()
        .describe("Known constraints: timeline, tech stack, compatibility"),
      workingDirectory: z.string().optional(),
    },
  },
  async ({ plan, codebasePath, constraints, workingDirectory }, extra) => {
    const progress = createProgressReporter(extra.sendNotification, extra._meta?.progressToken);
    let prompt = `Critique this implementation plan. Identify gaps, risks, missing edge cases, and suggest improvements.\n\nPlan:\n${plan}`;
    if (codebasePath) prompt += `\n\nRelevant codebase: ${codebasePath}`;
    if (constraints) prompt += `\n\nConstraints: ${constraints}`;

    const parsed = await runCodex(prompt, { workingDirectory, sandbox: "read-only", progress });
    return formatCodexResponse(parsed);
  },
);

server.registerTool(
  "codex_explain_code",
  {
    title: "Codex Explain Code",
    description:
      "Ask Codex to deeply explain code, logic, or architecture. Useful for understanding unfamiliar code, onboarding, or documenting complex systems.",
    inputSchema: {
      target: z
        .string()
        .describe("What to explain: file path, function name, module, or code snippet"),
      depth: z
        .enum(["overview", "detailed", "trace"])
        .optional()
        .default("detailed")
        .describe("Depth of explanation: overview, detailed, or full execution trace"),
      context: z.string().optional().describe("Additional context about the codebase"),
      workingDirectory: z.string().optional(),
    },
  },
  async ({ target, depth, context, workingDirectory }, extra) => {
    const progress = createProgressReporter(extra.sendNotification, extra._meta?.progressToken);
    const prompt = buildExplainCodePrompt({ target, depth, context });
    const parsed = await runCodex(prompt, { workingDirectory, sandbox: "read-only", progress });
    return formatCodexResponse(parsed);
  },
);

server.registerTool(
  "codex_plan_perf",
  {
    title: "Codex Performance Plan",
    description:
      "Ask Codex to analyze performance and create an improvement plan. Identifies bottlenecks, proposes ranked optimizations with expected impact.",
    inputSchema: {
      target: z.string().describe("What to optimize: function, module, or pipeline path"),
      metrics: z
        .array(z.enum(["latency", "throughput", "memory", "binary-size"]))
        .optional()
        .describe("Performance metrics to focus on"),
      constraints: z
        .string()
        .optional()
        .describe("Constraints: must not increase binary size, etc."),
      context: z.string().optional().describe("Additional context about usage patterns"),
      workingDirectory: z.string().optional(),
    },
  },
  async ({ target, metrics, constraints, context, workingDirectory }, extra) => {
    const progress = createProgressReporter(extra.sendNotification, extra._meta?.progressToken);
    const prompt = buildPlanPerfPrompt({ target, metrics, constraints, context });
    const parsed = await runCodex(prompt, { workingDirectory, sandbox: "read-only", progress });
    return formatCodexResponse(parsed);
  },
);

server.registerTool(
  "codex_implement",
  {
    title: "Codex Implement",
    description:
      "Ask Codex to implement a feature, fix a bug, or make code changes. WARNING: This modifies your codebase. Returns a summary of what was changed.",
    inputSchema: {
      task: z.string().describe("What to implement or fix"),
      workingDirectory: z.string().optional(),
      model: z.enum(CODEX_MODELS).optional().describe("Override the Codex model"),
      sandbox: z
        .enum(["workspace-write", "danger-full-access"])
        .optional()
        .default("workspace-write")
        .describe("Sandbox level (must allow writes)"),
    },
  },
  async ({ task, workingDirectory, model, sandbox }, extra) => {
    const progress = createProgressReporter(extra.sendNotification, extra._meta?.progressToken);
    const parsed = await runCodex(task, {
      workingDirectory,
      model,
      sandbox,
      fullAuto: true,
      progress,
    });
    return formatCodexResponse(parsed);
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("codex-bridge MCP server started on stdio");
}

main().catch((err) => {
  logger.error("Failed to start codex-bridge:", err);
  process.exit(1);
});
