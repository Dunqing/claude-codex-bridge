import { logger } from "./logger.js";
import type { ClaudeResult } from "./types.js";

/**
 * Parses the JSON output from `claude -p --output-format json`.
 * The output is a single JSON object with a `result` field containing
 * the response content.
 */
export function parseClaudeOutput(jsonOutput: string): ClaudeResult {
  const result: ClaudeResult = {
    resultText: "",
    sessionId: null,
    costUsd: null,
    errors: [],
  };

  const trimmed = jsonOutput.trim();
  if (!trimmed) {
    result.errors.push("Empty output from Claude CLI");
    return result;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Claude may have output plain text instead of JSON
    logger.debug("Failed to parse Claude output as JSON, using raw text");
    result.resultText = trimmed;
    return result;
  }

  // Extract result text from structured output
  // Claude JSON format: { result: string, ... } or { result: { content: [...] }, ... }
  const resultField = parsed["result"];
  if (typeof resultField === "string") {
    result.resultText = resultField;
  } else if (resultField && typeof resultField === "object") {
    const content = (resultField as Record<string, unknown>)[
      "content"
    ] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content)) {
      result.resultText = content
        .filter((c) => c["type"] === "text")
        .map((c) => c["text"] as string)
        .join("\n");
    }
  }

  // If result field didn't yield text, try other common fields
  if (!result.resultText) {
    const message = parsed["message"] as string | undefined;
    const text = parsed["text"] as string | undefined;
    const output = parsed["output"] as string | undefined;
    result.resultText = message ?? text ?? output ?? "";
  }

  // If still nothing, stringify the whole response
  if (!result.resultText && Object.keys(parsed).length > 0) {
    result.resultText = JSON.stringify(parsed, null, 2);
  }

  // Extract metadata
  result.sessionId = (parsed["session_id"] as string) ?? (parsed["sessionId"] as string) ?? null;
  result.costUsd = (parsed["cost_usd"] as number) ?? (parsed["costUsd"] as number) ?? null;

  // Check for errors
  const error = parsed["error"] as string | Record<string, unknown> | undefined;
  if (error) {
    const msg = typeof error === "string" ? error : (error["message"] as string) ?? JSON.stringify(error);
    result.errors.push(msg);
  }

  return result;
}
