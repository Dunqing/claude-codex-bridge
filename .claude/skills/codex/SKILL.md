---
name: codex
description: Ask OpenAI Codex for a second opinion — code reviews, explanations, plan critiques, performance analysis, or general questions
argument-hint: "<task or question>"
allowed-tools: "Read, Glob, Grep, Bash, mcp__codex__codex_query, mcp__codex__codex_review_code, mcp__codex__codex_review_plan, mcp__codex__codex_explain_code, mcp__codex__codex_plan_perf, mcp__codex__codex_implement"
---

You are invoking Codex to get a second opinion. Route the user's request to the most appropriate Codex MCP tool.

## Tool Selection

Pick the best tool based on the user's request:

| Request Type                | Tool                             | Key Parameters                              |
| --------------------------- | -------------------------------- | ------------------------------------------- |
| Code review, diff review    | `mcp__codex__codex_review_code`  | `target` (diff range or file), `focusAreas` |
| Plan critique               | `mcp__codex__codex_review_plan`  | `plan`, `codebasePath`                      |
| Explain code                | `mcp__codex__codex_explain_code` | `target` (file/function), `depth`           |
| Performance analysis        | `mcp__codex__codex_plan_perf`    | `target`, `metrics`                         |
| Implement/fix (writes code) | `mcp__codex__codex_implement`    | `task`                                      |
| General question            | `mcp__codex__codex_query`        | `prompt`                                    |

## Instructions

1. Parse the user's argument to determine the task type
2. If the user references files, read them first for context
3. Call the most specific Codex tool — prefer specialized tools over `codex_query`
4. Always pass `workingDirectory` to every tool call
5. Synthesize the response: summarize key findings, highlight important points, give actionable recommendations
6. Only use `codex_implement` if the user explicitly asks Codex to make changes

## Examples

- `/codex review my recent changes` → `codex_review_code` with target "HEAD~1..HEAD"
- `/codex explain src/lib/exec.ts` → `codex_explain_code` with target "src/lib/exec.ts"
- `/codex is my approach to caching correct?` → `codex_query` with the question
- `/codex optimize the response parsing` → `codex_plan_perf` with target
- `/codex implement error handling for timeouts` → `codex_implement` with task
