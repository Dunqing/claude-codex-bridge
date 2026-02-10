# Bidirectional MCP Bridge: Claude Code <-> Codex CLI

**Status: Complete**

## Context

Claude Code and Codex act as partners — each can ask the other for help, review plans, review code, explain code, and plan performance work. Both CLIs are installed locally. This project wraps both CLIs as MCP servers for bidirectional communication.

## Architecture

```
Claude Code  --stdio-->  codex-server (MCP)  --subprocess-->  codex exec
Codex        --stdio-->  claude-server (MCP)  --subprocess-->  claude -p
```

Two MCP servers in one TypeScript project, both using stdio transport.

## Project Structure

```
src/
  codex-server.ts           # Entry point: MCP server for Claude Code
  claude-server.ts          # Entry point: MCP server for Codex
  lib/
    exec-runner.ts          # Shared subprocess runner (timeout, abort, env)
    codex-output-parser.ts  # Parse JSONL from codex exec --json
    claude-output-parser.ts # Parse JSON from claude -p --output-format json
    prompt-builder.ts       # Build specialized prompts for perf/explain tools
    types.ts                # Shared types
    errors.ts               # BridgeError class
    logger.ts               # stderr-only logger (stdout is MCP protocol)
test/
  exec-runner.test.ts
  codex-output-parser.test.ts
  claude-output-parser.test.ts
  prompt-builder.test.ts
```

## Tools (12 total, 6 per server)

### codex-server (Claude calls Codex)

| Tool                 | Purpose                                     | Sandbox         |
| -------------------- | ------------------------------------------- | --------------- |
| `codex_query`        | General question to Codex                   | read-only       |
| `codex_review_code`  | Review git diff/files                       | read-only       |
| `codex_review_plan`  | Critique an implementation plan             | read-only       |
| `codex_explain_code` | Deep explanation of code/logic/architecture | read-only       |
| `codex_plan_perf`    | Plan performance improvements for a target  | read-only       |
| `codex_implement`    | Write/modify code                           | workspace-write |

### claude-server (Codex calls Claude)

| Tool                  | Purpose                                     | Max Turns |
| --------------------- | ------------------------------------------- | --------- |
| `claude_query`        | General question to Claude                  | 10        |
| `claude_review_code`  | Review git diff/files                       | 5         |
| `claude_review_plan`  | Critique an implementation plan             | 8         |
| `claude_explain_code` | Deep explanation of code/logic/architecture | 8         |
| `claude_plan_perf`    | Plan performance improvements for a target  | 10        |
| `claude_implement`    | Write/modify code                           | 15        |

## Key Design Decisions

- **Anti-recursion guard**: `BRIDGE_DEPTH` env var, refuse if >= 2
- **Logging**: All logs to stderr (stdout is MCP JSON-RPC)
- **Timeout**: Default 5min, configurable via `BRIDGE_TIMEOUT_MS`
- **Output parsing**: Codex JSONL + Claude JSON parsers, both with graceful fallback

## Implementation Stages

- [x] **Stage 1**: Project scaffolding + shared libs (`feat: scaffold project with shared libraries`)
- [x] **Stage 2**: codex-server with 6 tools (`feat: add codex MCP server (Claude calls Codex)`)
- [x] **Stage 3**: claude-server with 6 tools (`feat: add claude MCP server (Codex calls Claude)`)
- [x] **Stage 4**: CI + npm release pipeline (`ci: add GitHub Actions for CI and npm publishing`)
- [x] **Stage 5**: README + configuration docs (`docs: add README with setup and usage instructions`)

## Verification Checklist

- [x] `pnpm test` — 32 unit tests pass
- [x] MCP handshake — both servers respond to initialize
- [x] `pnpm publish --dry-run` — package publishable (13.9 kB)
- [ ] Live test: Claude calls Codex (requires MCP config)
- [ ] Live test: Codex calls Claude (requires MCP config)
