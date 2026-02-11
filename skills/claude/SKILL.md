---
name: claude
description: Ask Claude Code for a second opinion — code reviews, explanations, plan critiques, performance analysis, or general questions
---

You are invoking Claude Code to get a second opinion. Route the user's request to the most appropriate Claude MCP tool.

## Tool Selection

Pick the best tool based on the user's request:

| Request Type                | Tool                               | Key Parameters                              |
| --------------------------- | ---------------------------------- | ------------------------------------------- |
| Code review, diff review    | `mcp__claude__claude_review_code`  | `target` (diff range or file), `focusAreas` |
| Plan critique               | `mcp__claude__claude_review_plan`  | `plan`, `codebasePath`                      |
| Explain code                | `mcp__claude__claude_explain_code` | `target` (file/function), `depth`           |
| Performance analysis        | `mcp__claude__claude_plan_perf`    | `target`, `metrics`                         |
| Implement/fix (writes code) | `mcp__claude__claude_implement`    | `task`                                      |
| General question            | `mcp__claude__claude_query`        | `prompt`                                    |

## Instructions

1. Parse the user's request to determine the task type
2. If the user references files, read them first for context
3. Call the most specific Claude tool — prefer specialized tools over `claude_query`
4. Always pass `workingDirectory` to every tool call
5. Synthesize the response: summarize key findings, highlight important points, give actionable recommendations
6. Only use `claude_implement` if the user explicitly asks Claude to make changes

## Examples

- `/claude review my recent changes` → `claude_review_code` with target "HEAD~1..HEAD"
- `/claude explain src/lib/exec.ts` → `claude_explain_code` with target "src/lib/exec.ts"
- `/claude is my approach to caching correct?` → `claude_query` with the question
- `/claude optimize the response parsing` → `claude_plan_perf` with target
- `/claude implement error handling for timeouts` → `claude_implement` with task
