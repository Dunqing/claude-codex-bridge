import { describe, it, expect } from "vitest";
import { parseCodexOutput } from "../src/lib/codex-output-parser.js";

describe("parseCodexOutput", () => {
  it("parses a simple agent message (nested format)", () => {
    const jsonl = [
      JSON.stringify({ type: "thread.started", thread_id: "t-123" }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_0", type: "agent_message", text: "The answer is 42." },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    ].join("\n");

    const result = parseCodexOutput(jsonl);
    expect(result.threadId).toBe("t-123");
    expect(result.agentMessage).toBe("The answer is 42.");
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(result.errors).toHaveLength(0);
  });

  it("collects file changes (nested format)", () => {
    const jsonl = [
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_0", type: "file_change", path: "src/main.ts", kind: "update" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_1", type: "file_change", path: "src/new.ts", kind: "add" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_2", type: "agent_message", text: "Done" },
      }),
    ].join("\n");

    const result = parseCodexOutput(jsonl);
    expect(result.fileChanges).toHaveLength(2);
    expect(result.fileChanges[0]).toEqual({
      path: "src/main.ts",
      kind: "update",
    });
    expect(result.fileChanges[1]).toEqual({
      path: "src/new.ts",
      kind: "add",
    });
  });

  it("collects command executions with aggregated_output (nested format)", () => {
    const jsonl = JSON.stringify({
      type: "item.completed",
      item: {
        id: "item_0",
        type: "command_execution",
        command: "npm test",
        exit_code: 0,
        aggregated_output: "All tests passed",
        status: "completed",
      },
    });

    const result = parseCodexOutput(jsonl);
    expect(result.commandsExecuted).toHaveLength(1);
    expect(result.commandsExecuted[0]!.command).toBe("npm test");
    expect(result.commandsExecuted[0]!.exitCode).toBe(0);
    expect(result.commandsExecuted[0]!.output).toBe("All tests passed");
  });

  it("captures errors from turn.failed", () => {
    const jsonl = JSON.stringify({
      type: "turn.failed",
      error: "API key invalid",
    });

    const result = parseCodexOutput(jsonl);
    expect(result.errors).toEqual(["API key invalid"]);
  });

  it("skips malformed JSON lines gracefully", () => {
    const jsonl = [
      "not json at all",
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_0", type: "agent_message", text: "Result" },
      }),
      "{broken json",
    ].join("\n");

    const result = parseCodexOutput(jsonl);
    expect(result.agentMessage).toBe("Result");
    expect(result.errors).toHaveLength(0);
  });

  it("handles empty output", () => {
    const result = parseCodexOutput("");
    expect(result.agentMessage).toBe("");
    expect(result.errors).toHaveLength(0);
  });

  it("uses last agent message when multiple exist", () => {
    const jsonl = [
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_0", type: "agent_message", text: "First" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "item_1", type: "agent_message", text: "Second" },
      }),
    ].join("\n");

    const result = parseCodexOutput(jsonl);
    expect(result.agentMessage).toBe("Second");
  });

  it("falls back to raw output when no JSON events", () => {
    const result = parseCodexOutput("plain text response");
    expect(result.agentMessage).toBe("plain text response");
  });

  it("supports legacy flat format for backward compatibility", () => {
    const jsonl = [
      JSON.stringify({ type: "thread.started", threadId: "t-legacy" }),
      JSON.stringify({
        type: "item.completed",
        itemType: "agent_message",
        text: "Legacy format",
      }),
    ].join("\n");

    const result = parseCodexOutput(jsonl);
    expect(result.threadId).toBe("t-legacy");
    expect(result.agentMessage).toBe("Legacy format");
  });

  it("truncates large command output", () => {
    const largeOutput = "x".repeat(20_000);
    const jsonl = JSON.stringify({
      type: "item.completed",
      item: {
        id: "item_0",
        type: "command_execution",
        command: "cat bigfile",
        exit_code: 0,
        aggregated_output: largeOutput,
      },
    });

    const result = parseCodexOutput(jsonl);
    expect(result.commandsExecuted[0]!.output.length).toBeLessThan(largeOutput.length);
    expect(result.commandsExecuted[0]!.output).toContain("[truncated]");
  });
});
