# claude-codex-bridge

[![npm version](https://img.shields.io/npm/v/claude-codex-bridge?color=f97316)](https://www.npmjs.com/package/claude-codex-bridge)
[![npm downloads](https://img.shields.io/npm/dm/claude-codex-bridge?color=3b82f6)](https://www.npmjs.com/package/claude-codex-bridge)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Bidirectional [MCP](https://modelcontextprotocol.io/) server bridge between **Claude Code** and **OpenAI Codex CLI**.

Let Claude and Codex work as partners — each can ask the other for help, review code, explain logic, and plan performance improvements.

```
┌──────────────┐         MCP          ┌──────────────┐
│              │ ◄──────────────────► │              │
│  Claude Code │    claude-codex      │  Codex CLI   │
│              │ ◄───── bridge ─────► │              │
└──────────────┘                      └──────────────┘
```

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — installed and authenticated
- [Codex CLI](https://developers.openai.com/codex/cli/) — installed and authenticated
- [Node.js](https://nodejs.org) >= 18

## Quick Start

Set up everything with a single command:

```bash
npx claude-codex-bridge setup
```

This registers MCP servers for both Claude Code and Codex, and installs the `/codex` skill and codex-teammate agent.

## Setup

### Automatic (recommended)

```bash
npx claude-codex-bridge setup              # Full setup: both directions + skill + agent
npx claude-codex-bridge setup claude       # Only Claude Code → Codex
npx claude-codex-bridge setup codex        # Only Codex → Claude
npx claude-codex-bridge setup --skip-extras  # MCP servers only, no skill/agent
```

Use `--global` or `--local` to control where the skill and agent are installed (defaults to interactive prompt).

### Manual

<details>
<summary><strong>Claude Code → Codex</strong> (let Claude call Codex)</summary>

Add to your Claude Code MCP config:

```bash
claude mcp add codex -s user -- npx claude-codex-bridge serve codex
```

Or add to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "codex": {
      "type": "stdio",
      "command": "npx",
      "args": ["claude-codex-bridge", "serve", "codex"]
    }
  }
}
```

</details>

<details>
<summary><strong>Codex → Claude</strong> (let Codex call Claude)</summary>

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.claude]
command = "npx"
args = ["claude-codex-bridge", "serve", "claude"]
tool_timeout_sec = 600
```

</details>

## Usage

Once set up, just talk to Claude Code or Codex naturally. The bridge tools are picked up automatically.

### In Claude Code — ask Codex for help

```
> Ask Codex to review my recent changes

> Get Codex's opinion on whether this approach is correct: [paste plan]

> Have Codex explain how the parser in src/lib/codex-output-parser.ts works

> Ask Codex to analyze performance bottlenecks in the exec runner

> Ask Codex to implement error handling for the retry logic
```

### In Codex — ask Claude for help

```
> Ask Claude to review the changes in HEAD~3..HEAD

> Have Claude explain the architecture of this project

> Ask Claude to critique my plan for adding caching
```

### Using the `/codex` slash command (Claude Code)

Install the skill to get the `/codex` shortcut in Claude Code:

```bash
npx claude-codex-bridge install skill claude --global    # or --local
```

Then use it:

```
/codex review my recent changes
/codex explain src/lib/exec-runner.ts
/codex is my approach to caching correct?
/codex optimize the output parser for memory usage
```

### Using the `/claude` slash command (Codex)

Install the skill to get the `/claude` shortcut in Codex:

```bash
npx claude-codex-bridge install skill codex --global    # or --local
```

Then use it:

```
/claude review my recent changes
/claude explain the architecture of this project
/claude critique my plan for adding caching
```

### Spawning Codex as a teammate

For parallel work, spawn Codex as a subagent from Claude Code:

```
> Spawn a codex-teammate to review src/lib/exec-runner.ts while we keep working
```

## Tools

### `ccb-codex` — Claude calls Codex

| Tool                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `codex_query`        | Ask Codex a question or give it a task           |
| `codex_review_code`  | Ask Codex to review code changes                 |
| `codex_review_plan`  | Ask Codex to critique an implementation plan     |
| `codex_explain_code` | Ask Codex to explain code / logic / architecture |
| `codex_plan_perf`    | Ask Codex to plan performance improvements       |
| `codex_implement`    | Ask Codex to write or modify code                |

### `ccb-claude` — Codex calls Claude

| Tool                  | Description                                       |
| --------------------- | ------------------------------------------------- |
| `claude_query`        | Ask Claude a question or give it a task           |
| `claude_review_code`  | Ask Claude to review code changes                 |
| `claude_review_plan`  | Ask Claude to critique an implementation plan     |
| `claude_explain_code` | Ask Claude to explain code / logic / architecture |
| `claude_plan_perf`    | Ask Claude to plan performance improvements       |
| `claude_implement`    | Ask Claude to write or modify code                |

## Codex Teammate Agent

You can spawn Codex as a **Claude Code teammate** — a subagent that automatically uses the bridge tools to give you a second opinion, review code, or work on tasks in parallel.

### Install the Agent

```bash
npx claude-codex-bridge install agent --global    # or --local
```

### Usage

Once installed, spawn the teammate from Claude Code using the Task tool:

```
# Code review
Task(subagent_type: "codex-teammate", prompt: "Review src/lib/exec-runner.ts for bugs and performance issues")

# Explain unfamiliar code
Task(subagent_type: "codex-teammate", prompt: "Explain the architecture of the MCP server in codex-server.ts")

# Critique a plan
Task(subagent_type: "codex-teammate", prompt: "Critique this plan: [your plan here]")

# Performance analysis
Task(subagent_type: "codex-teammate", prompt: "Analyze performance bottlenecks in the output parser")

# General question
Task(subagent_type: "codex-teammate", prompt: "What's the best approach for adding retry logic to the bridge?")
```

The agent automatically picks the right Codex tool (`codex_review_code`, `codex_explain_code`, `codex_plan_perf`, etc.) based on your request.

## Configuration

| Variable             | Description                                                  | Default           |
| -------------------- | ------------------------------------------------------------ | ----------------- |
| `BRIDGE_TIMEOUT_MS`  | Subprocess timeout in milliseconds                           | `600000` (10 min) |
| `BRIDGE_MAX_RETRIES` | Auto-retries on transient errors (rate limits, 5xx, network) | `2`               |
| `BRIDGE_DEBUG`       | Enable debug logging to stderr                               | —                 |
| `BRIDGE_DEPTH`       | Current recursion depth (set automatically)                  | `0`               |

### Anti-Recursion Guard

The bridge automatically prevents infinite loops. If Claude calls Codex which tries to call Claude again, the second call is blocked (`BRIDGE_DEPTH >= 2`).

## Development

```bash
git clone https://github.com/Dunqing/claude-codex-bridge.git
cd claude-codex-bridge
pnpm install

pnpm build         # Compile to dist/
pnpm test          # Run tests
pnpm lint          # Lint and type check

# Dev mode (no build needed)
pnpm dev:codex-server
pnpm dev:claude-server
```

## License

[MIT](./LICENSE)
