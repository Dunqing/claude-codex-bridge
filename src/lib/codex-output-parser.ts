import { logger } from "./logger.js";
import type { CodexResult } from "./types.js";

/**
 * Parses the JSONL output from `codex exec --json`.
 * Each line is a JSON event with a `type` field.
 * We extract the final agent message, file changes, commands, and usage.
 */
export function parseCodexOutput(jsonlOutput: string): CodexResult {
  const result: CodexResult = {
    threadId: null,
    agentMessage: "",
    fileChanges: [],
    commandsExecuted: [],
    usage: null,
    errors: [],
  };

  const lines = jsonlOutput.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      logger.debug(`Skipping non-JSON line: ${line.slice(0, 100)}`);
      continue;
    }

    const type = event["type"] as string | undefined;
    if (!type) continue;

    switch (type) {
      case "thread.started": {
        result.threadId = (event["threadId"] as string) ?? null;
        break;
      }

      case "item.completed": {
        const itemType = event["itemType"] as string | undefined;
        if (itemType === "agent_message" || itemType === "message") {
          const text =
            (event["text"] as string) ??
            (event["content"] as string) ??
            "";
          if (text) result.agentMessage = text;
        } else if (itemType === "file_change") {
          const path = (event["path"] as string) ?? "";
          const kind = (event["kind"] as string) ?? "update";
          if (path) result.fileChanges.push({ path, kind });
        } else if (itemType === "command_execution") {
          result.commandsExecuted.push({
            command: (event["command"] as string) ?? "",
            exitCode: (event["exitCode"] as number) ?? null,
            output: (event["output"] as string) ?? "",
          });
        }
        break;
      }

      case "turn.completed": {
        const usage = event["usage"] as
          | Record<string, number>
          | undefined;
        if (usage) {
          result.usage = {
            inputTokens: usage["input_tokens"] ?? usage["inputTokens"] ?? 0,
            outputTokens:
              usage["output_tokens"] ?? usage["outputTokens"] ?? 0,
          };
        }
        break;
      }

      case "turn.failed":
      case "error": {
        const msg =
          (event["error"] as string) ??
          (event["message"] as string) ??
          JSON.stringify(event);
        result.errors.push(msg);
        break;
      }
    }
  }

  // If we found no agent message but have raw output, use it as fallback.
  // This handles cases where codex outputs plain text instead of JSONL.
  if (!result.agentMessage && jsonlOutput.trim()) {
    result.agentMessage = jsonlOutput.trim();
  }

  return result;
}
