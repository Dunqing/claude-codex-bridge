#!/usr/bin/env node

const subcommand = process.argv[2];

if (subcommand === "codex") {
  await import("./codex-server.js");
} else if (subcommand === "claude") {
  await import("./claude-server.js");
} else {
  console.error(
    `Usage: claude-codex-bridge <codex|claude>\n\n  codex   Start the Codex MCP server (for Claude Code)\n  claude  Start the Claude MCP server (for Codex CLI)`,
  );
  process.exit(1);
}
