# claude-codex-bridge

Bidirectional MCP server bridge between **Claude Code** and **OpenAI Codex CLI**. Lets Claude and Codex work as partners — each can ask the other for help, review code, explain logic, and plan performance improvements.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Codex CLI](https://developers.openai.com/codex/cli/) installed and authenticated
- Node.js >= 18

## Install

```bash
# No install needed — use directly via npx
npx -p claude-codex-bridge ccb-codex
npx -p claude-codex-bridge ccb-claude

# Or clone and build locally
git clone https://github.com/Dunqing/claude-codex-bridge.git
cd claude-codex-bridge
pnpm install
pnpm build
```

## Setup

### Automatic (recommended)

Run `/setup` in Claude Code to automatically configure both directions:

```
/setup          # Set up both Claude Code and Codex
/setup claude   # Only set up Claude Code → Codex
/setup codex    # Only set up Codex → Claude
```

If you don't have the repo cloned, you can simply ask Claude Code:

> Please help me set up claude-codex-bridge MCP for both Claude Code and Codex according to https://github.com/Dunqing/claude-codex-bridge/blob/main/.claude/skills/setup/SKILL.md

### Manual

#### Claude Code → Codex (let Claude call Codex)

Add to your Claude Code MCP config:

```bash
claude mcp add codex -- npx -p claude-codex-bridge ccb-codex
```

Or add to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "codex": {
      "type": "stdio",
      "command": "npx",
      "args": ["-p", "claude-codex-bridge", "ccb-codex"]
    }
  }
}
```

#### Codex → Claude (let Codex call Claude)

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.claude]
command = "npx"
args = ["-p", "claude-codex-bridge", "ccb-claude"]
tool_timeout_sec = 300
```

## Tools

### codex-server (Claude calls Codex)

| Tool | Description |
|------|-------------|
| `codex_query` | Ask Codex a question or give it a task |
| `codex_review_code` | Ask Codex to review code changes |
| `codex_review_plan` | Ask Codex to critique an implementation plan |
| `codex_explain_code` | Ask Codex to explain code/logic/architecture |
| `codex_plan_perf` | Ask Codex to plan performance improvements |
| `codex_implement` | Ask Codex to write/modify code |

### claude-server (Codex calls Claude)

| Tool | Description |
|------|-------------|
| `claude_query` | Ask Claude a question or give it a task |
| `claude_review_code` | Ask Claude to review code changes |
| `claude_review_plan` | Ask Claude to critique an implementation plan |
| `claude_explain_code` | Ask Claude to explain code/logic/architecture |
| `claude_plan_perf` | Ask Claude to plan performance improvements |
| `claude_implement` | Ask Claude to write/modify code |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BRIDGE_TIMEOUT_MS` | Subprocess timeout in milliseconds | `300000` (5 min) |
| `BRIDGE_DEBUG` | Enable debug logging to stderr | unset |
| `BRIDGE_DEPTH` | Current recursion depth (set automatically) | `0` |

### Anti-Recursion Guard

The bridge automatically prevents infinite loops. If Claude calls Codex which tries to call Claude again, the second call is blocked (`BRIDGE_DEPTH >= 2`).

## Development

```bash
pnpm install
pnpm test          # Run tests
pnpm typecheck     # Type check
pnpm build         # Compile to dist/

# Dev mode (no build needed)
pnpm dev:codex-server
pnpm dev:claude-server
```

## License

MIT
