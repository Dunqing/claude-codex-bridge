---
name: setup
description: Set up claude-codex-bridge for Claude Code and/or Codex CLI
argument-hint: "[both|claude|codex]"
allowed-tools: "Read, Edit, Write, Bash, Glob, Grep"
---

Set up claude-codex-bridge so Claude Code and Codex CLI can call each other as MCP partners.

The user may pass an argument: `both` (default), `claude`, or `codex`.

## Setup Claude Code -> Codex (let Claude call Codex)

Run this command to register the codex MCP server:

```bash
claude mcp add codex -s user -- npx claude-codex-bridge serve codex
```

After running, verify it was added by checking:

```bash
claude mcp list
```

Confirm that `codex` appears in the list.

## Setup Codex -> Claude (let Codex call Claude)

1. First check if `~/.codex/config.toml` exists. If not, create the directory and file.

2. Read the existing file content. Then append or add the following TOML block (only if `[mcp_servers.claude]` is not already present):

```toml
[mcp_servers.claude]
command = "npx"
args = ["claude-codex-bridge", "serve", "claude"]
tool_timeout_sec = 600
```

Be careful not to duplicate the section if it already exists. If it exists, ask the user if they want to update it.

## Install Codex Teammate Agent (optional)

The codex-teammate agent lets you spawn Codex as a Claude Code subagent/teammate. It knows how to use all 6 codex bridge tools automatically.

Run:

```bash
npx claude-codex-bridge install agent --global
```

Or for project-local:

```bash
npx claude-codex-bridge install agent --local
```

Verify the agent is available by starting a new Claude Code session. The agent will appear as `codex-teammate` subagent type in the Task tool.

## Install /codex Skill for Claude Code (optional)

```bash
npx claude-codex-bridge install skill claude --global
```

## Install /claude Skill for Codex (optional)

```bash
npx claude-codex-bridge install skill codex --global
```

## After Setup

Tell the user:

- For Claude Code: restart Claude Code or start a new session for the MCP server to be available
- For Codex: restart Codex for the MCP server to be available
- Available tools: `codex_query`, `codex_review_code`, `codex_review_plan`, `codex_explain_code`, `codex_plan_perf`, `codex_implement` (from Claude), and `claude_query`, `claude_review_code`, `claude_review_plan`, `claude_explain_code`, `claude_plan_perf`, `claude_implement` (from Codex)
- **Codex Teammate Agent**: If installed, you can spawn Codex as a teammate with `Task(subagent_type: "codex-teammate", prompt: "your task here")`
