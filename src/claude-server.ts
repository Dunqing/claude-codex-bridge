#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execCommand } from "./lib/exec-runner.js";
import { parseClaudeOutput } from "./lib/claude-output-parser.js";
import { buildExplainCodePrompt, buildPlanPerfPrompt } from "./lib/prompt-builder.js";
import { logger } from "./lib/logger.js";
import { CLAUDE_MODELS } from "./lib/types.js";
import type { ClaudeResult } from "./lib/types.js";

const server = new McpServer({
  name: "claude-bridge",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runClaude(
  prompt: string,
  options: {
    workingDirectory?: string;
    model?: string;
    maxTurns?: number;
    allowedTools?: string[];
  } = {},
): Promise<ClaudeResult> {
  const args = ["-p", "--output-format", "json"];
  if (options.model) args.push("--model", options.model);
  if (options.maxTurns) args.push("--max-turns", String(options.maxTurns));
  if (options.allowedTools && options.allowedTools.length > 0) {
    for (const tool of options.allowedTools) {
      args.push("--allowedTools", tool);
    }
  }
  args.push(prompt);

  const result = await execCommand({
    command: "claude",
    args,
    cwd: options.workingDirectory,
  });

  if (result.timedOut) {
    return {
      resultText: "",
      sessionId: null,
      costUsd: null,
      errors: ["Claude timed out. Increase BRIDGE_TIMEOUT_MS if needed."],
    };
  }

  const parsed = parseClaudeOutput(result.stdout);

  // Check stderr for API key issues
  if (result.exitCode !== 0 && !parsed.resultText) {
    const stderr = result.stderr.toLowerCase();
    if (
      stderr.includes("api key") ||
      stderr.includes("authentication") ||
      stderr.includes("unauthorized")
    ) {
      parsed.errors.push("Claude API key issue. Ensure ANTHROPIC_API_KEY is set.");
    } else if (result.stderr.trim()) {
      parsed.errors.push(result.stderr.trim());
    }
  }

  return parsed;
}

function formatClaudeResponse(parsed: ClaudeResult): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  if (parsed.errors.length > 0 && !parsed.resultText) {
    return {
      content: [{ type: "text" as const, text: `Error: ${parsed.errors.join("; ")}` }],
      isError: true,
    };
  }

  return { content: [{ type: "text" as const, text: parsed.resultText }] };
}

// Read-only tool set for review/analysis tasks
const READ_ONLY_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "Bash(git diff *)",
  "Bash(git log *)",
  "Bash(git show *)",
];

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.registerTool(
  "claude_query",
  {
    title: "Ask Claude",
    description:
      "Ask Claude Code a question or give it a task. Claude will use its full toolset (file reading, code search, web search, etc.) to answer.",
    inputSchema: {
      prompt: z.string().describe("The question or task for Claude"),
      workingDirectory: z
        .string()
        .optional()
        .describe("Working directory (defaults to server cwd)"),
      model: z.enum(CLAUDE_MODELS).optional().describe("Claude model alias"),
      maxTurns: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum agentic turns (limits runtime)"),
      allowedTools: z
        .array(z.string())
        .optional()
        .describe('Restrict tools (e.g., ["Read", "Grep", "Glob"])'),
    },
  },
  async ({ prompt, workingDirectory, model, maxTurns, allowedTools }) => {
    const parsed = await runClaude(prompt, { workingDirectory, model, maxTurns, allowedTools });
    return formatClaudeResponse(parsed);
  },
);

server.registerTool(
  "claude_review_code",
  {
    title: "Claude Code Review",
    description:
      "Ask Claude to review code for quality, bugs, security issues, and best practices. Provide a git diff range, file paths, or code snippet.",
    inputSchema: {
      target: z.string().describe("What to review: git diff range, file paths, or code snippet"),
      focusAreas: z
        .string()
        .optional()
        .describe("Focus on: bugs, performance, style, security, etc."),
      context: z.string().optional().describe("Additional context about the changes"),
      workingDirectory: z.string().optional(),
      maxTurns: z.number().optional().default(5),
    },
  },
  async ({ target, focusAreas, context, workingDirectory, maxTurns }) => {
    let prompt = `Review the following code changes. Provide specific, actionable feedback with line references.\n\nTarget: ${target}`;
    if (focusAreas) prompt += `\n\nFocus areas: ${focusAreas}`;
    if (context) prompt += `\n\nContext: ${context}`;

    const parsed = await runClaude(prompt, {
      workingDirectory,
      maxTurns,
      allowedTools: READ_ONLY_TOOLS,
    });
    return formatClaudeResponse(parsed);
  },
);

server.registerTool(
  "claude_review_plan",
  {
    title: "Claude Plan Review",
    description:
      "Ask Claude to critique an implementation plan. Claude will examine the actual codebase to validate feasibility and consistency with existing patterns.",
    inputSchema: {
      plan: z.string().describe("The implementation plan to review"),
      codebasePath: z.string().optional().describe("Path to relevant codebase for context"),
      constraints: z.string().optional().describe("Known constraints"),
      workingDirectory: z.string().optional(),
      maxTurns: z.number().optional().default(8),
    },
  },
  async ({ plan, codebasePath, constraints, workingDirectory, maxTurns }) => {
    let prompt = `Critique this implementation plan. Evaluate feasibility against the actual codebase, check consistency with existing patterns, identify gaps and risks.\n\nPlan:\n${plan}`;
    if (codebasePath) prompt += `\n\nRelevant codebase: ${codebasePath}`;
    if (constraints) prompt += `\n\nConstraints: ${constraints}`;

    const parsed = await runClaude(prompt, {
      workingDirectory,
      maxTurns,
      allowedTools: READ_ONLY_TOOLS,
    });
    return formatClaudeResponse(parsed);
  },
);

server.registerTool(
  "claude_explain_code",
  {
    title: "Claude Explain Code",
    description:
      "Ask Claude to deeply explain code, logic, or architecture. Claude will read the actual source files to give grounded explanations.",
    inputSchema: {
      target: z
        .string()
        .describe("What to explain: file path, function name, module, or code snippet"),
      depth: z
        .enum(["overview", "detailed", "trace"])
        .optional()
        .default("detailed")
        .describe("Depth: overview, detailed, or full execution trace"),
      context: z.string().optional().describe("Additional context about the codebase"),
      workingDirectory: z.string().optional(),
      maxTurns: z.number().optional().default(8),
    },
  },
  async ({ target, depth, context, workingDirectory, maxTurns }) => {
    const prompt = buildExplainCodePrompt({ target, depth, context });
    const parsed = await runClaude(prompt, {
      workingDirectory,
      maxTurns,
      allowedTools: READ_ONLY_TOOLS,
    });
    return formatClaudeResponse(parsed);
  },
);

server.registerTool(
  "claude_plan_perf",
  {
    title: "Claude Performance Plan",
    description:
      "Ask Claude to analyze performance and create an improvement plan. Claude reads the actual code to identify bottlenecks and propose optimizations.",
    inputSchema: {
      target: z.string().describe("What to optimize: function, module, or pipeline path"),
      metrics: z
        .array(z.enum(["latency", "throughput", "memory", "binary-size"]))
        .optional()
        .describe("Performance metrics to focus on"),
      constraints: z.string().optional().describe("Constraints"),
      context: z.string().optional().describe("Additional context about usage patterns"),
      workingDirectory: z.string().optional(),
      maxTurns: z.number().optional().default(10),
    },
  },
  async ({ target, metrics, constraints, context, workingDirectory, maxTurns }) => {
    const prompt = buildPlanPerfPrompt({ target, metrics, constraints, context });
    const parsed = await runClaude(prompt, {
      workingDirectory,
      maxTurns,
      allowedTools: READ_ONLY_TOOLS,
    });
    return formatClaudeResponse(parsed);
  },
);

server.registerTool(
  "claude_implement",
  {
    title: "Claude Implement",
    description:
      "Ask Claude to implement a feature, fix a bug, or make code changes. WARNING: This modifies your codebase.",
    inputSchema: {
      task: z.string().describe("What to implement or fix"),
      workingDirectory: z.string().optional(),
      model: z.enum(CLAUDE_MODELS).optional().describe("Claude model alias"),
      maxTurns: z.number().optional().default(15),
    },
  },
  async ({ task, workingDirectory, model, maxTurns }) => {
    const parsed = await runClaude(task, { workingDirectory, model, maxTurns });
    return formatClaudeResponse(parsed);
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("claude-bridge MCP server started on stdio");
}

main().catch((err) => {
  logger.error("Failed to start claude-bridge:", err);
  process.exit(1);
});
