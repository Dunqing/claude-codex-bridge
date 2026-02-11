import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import consola from "consola";

export type InstallScope = "global" | "local";

// ---------------------------------------------------------------------------
// Package root resolution
// ---------------------------------------------------------------------------

function findPkgRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Cannot find package root");
    dir = parent;
  }
  return dir;
}

function readTemplate(relativePath: string): Promise<string> {
  return readFile(join(findPkgRoot(), relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

export async function promptScope(): Promise<InstallScope> {
  const answer = await consola.prompt("Where should it be installed?", {
    type: "select",
    options: [
      { label: "Global (~/.claude/ or ~/.agents/)", value: "global" },
      { label: "Local (.claude/ or .agents/)", value: "local" },
    ],
  });
  if (typeof answer === "symbol") process.exit(0);
  return answer as InstallScope;
}

async function confirmOverwrite(path: string): Promise<boolean> {
  const answer = await consola.prompt(`File already exists at ${path}. Overwrite?`, {
    type: "confirm",
    initial: false,
  });
  if (typeof answer === "symbol") process.exit(0);
  return answer;
}

export function resolveScope(globalFlag?: boolean, localFlag?: boolean): InstallScope | null {
  if (globalFlag) return "global";
  if (localFlag) return "local";
  return null;
}

// ---------------------------------------------------------------------------
// Install helpers
// ---------------------------------------------------------------------------

async function installFile(destDir: string, fileName: string, content: string): Promise<boolean> {
  await mkdir(destDir, { recursive: true });
  const dest = join(destDir, fileName);

  if (existsSync(dest)) {
    const overwrite = await confirmOverwrite(dest);
    if (!overwrite) {
      console.log("  Skipped.");
      return false;
    }
  }

  await writeFile(dest, content, "utf-8");
  console.log(`  Installed to ${dest}`);
  return true;
}

// ---------------------------------------------------------------------------
// Install for Claude Code (skills + agents go into .claude/)
// ---------------------------------------------------------------------------

export async function installClaudeSkill(scope: InstallScope): Promise<void> {
  const base =
    scope === "global"
      ? join(homedir(), ".claude", "skills", "codex")
      : join(process.cwd(), ".claude", "skills", "codex");

  const content = await readTemplate("skills/codex/SKILL.md");
  await installFile(base, "SKILL.md", content);
}

export async function installClaudeAgent(scope: InstallScope): Promise<void> {
  const base =
    scope === "global"
      ? join(homedir(), ".claude", "agents")
      : join(process.cwd(), ".claude", "agents");

  const content = await readTemplate("agents/codex-teammate.md");
  await installFile(base, "codex-teammate.md", content);
}

// ---------------------------------------------------------------------------
// Install for Codex (skills go into .agents/skills/)
// ---------------------------------------------------------------------------

export async function installCodexSkill(scope: InstallScope): Promise<void> {
  const base =
    scope === "global"
      ? join(homedir(), ".agents", "skills", "claude")
      : join(process.cwd(), ".agents", "skills", "claude");

  const content = await readTemplate("skills/claude/SKILL.md");
  await installFile(base, "SKILL.md", content);
}

// ---------------------------------------------------------------------------
// Setup MCP servers
// ---------------------------------------------------------------------------

function exec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
  });
}

const CLAUDE_MCP_ARGS = [
  "mcp",
  "add",
  "codex",
  "-s",
  "user",
  "--",
  "npx",
  "claude-codex-bridge",
  "serve",
  "codex",
];

export async function setupClaude(): Promise<void> {
  console.log("\nSetting up Claude Code → Codex...");
  try {
    await exec("claude", CLAUDE_MCP_ARGS);
    console.log("  Registered 'codex' MCP server in Claude Code.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      const overwrite = await consola.prompt(
        "MCP server 'codex' already registered. Re-register with latest config?",
        {
          type: "confirm",
          initial: true,
        },
      );
      if (typeof overwrite === "symbol") process.exit(0);
      if (overwrite) {
        await exec("claude", ["mcp", "remove", "codex", "-s", "user"]);
        await exec("claude", CLAUDE_MCP_ARGS);
        console.log("  Re-registered 'codex' MCP server in Claude Code.");
      } else {
        console.log("  Skipped.");
      }
    } else {
      console.error(`  Failed: ${msg}`);
      console.error(
        "  You can register manually: claude mcp add codex -s user -- npx claude-codex-bridge serve codex",
      );
    }
  }
}

const CODEX_TOML_SECTION = `[mcp_servers.claude]
command = "npx"
args = ["claude-codex-bridge", "serve", "claude"]
tool_timeout_sec = 600
`;

export async function setupCodex(): Promise<void> {
  console.log("\nSetting up Codex → Claude...");
  const configDir = join(homedir(), ".codex");
  const configPath = join(configDir, "config.toml");

  await mkdir(configDir, { recursive: true });

  let content = "";
  if (existsSync(configPath)) {
    content = await readFile(configPath, "utf-8");
  }

  if (content.includes("[mcp_servers.claude]")) {
    const overwrite = await consola.prompt(
      "[mcp_servers.claude] already exists in config.toml. Replace with latest config?",
      {
        type: "confirm",
        initial: true,
      },
    );
    if (typeof overwrite === "symbol") process.exit(0);
    if (!overwrite) {
      console.log("  Skipped.");
      return;
    }
    // Remove existing section (everything from [mcp_servers.claude] to next section or EOF)
    content = content
      .replace(/\[mcp_servers\.claude\][^[]*/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const separator =
    content.length > 0 && !content.endsWith("\n") ? "\n\n" : content.length > 0 ? "\n" : "";
  await writeFile(configPath, content + separator + CODEX_TOML_SECTION, "utf-8");
  console.log(
    `  ${content.includes("[mcp_servers.claude]") ? "Updated" : "Added"} [mcp_servers.claude] in ${configPath}`,
  );
}
