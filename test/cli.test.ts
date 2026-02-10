import { describe, it, expect } from "vitest";
import { execCommand } from "../src/lib/exec-runner.js";

const CLI_PATH = new URL("../src/cli.ts", import.meta.url).pathname;

function runCli(args: string[]) {
  return execCommand({
    command: "npx",
    args: ["tsx", CLI_PATH, ...args],
    timeoutMs: 5000,
  });
}

describe("cli", () => {
  it("exits with error and shows usage when no subcommand given", async () => {
    const result = await runCli([]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Usage: claude-codex-bridge");
    expect(result.stderr).toContain("codex");
    expect(result.stderr).toContain("claude");
  });

  it("exits with error for unknown subcommand", async () => {
    const result = await runCli(["unknown"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Usage: claude-codex-bridge");
  });

  it("starts codex server on 'codex' subcommand", async () => {
    const result = await runCli(["codex"]);
    // The server starts on stdio and blocks waiting for input,
    // so it will be killed by timeout. Check that it started successfully.
    expect(result.stderr).toContain("codex-bridge MCP server started");
  });

  it("starts claude server on 'claude' subcommand", async () => {
    const result = await runCli(["claude"]);
    expect(result.stderr).toContain("claude-bridge MCP server started");
  });
});
