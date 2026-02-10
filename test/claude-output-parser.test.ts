import { describe, it, expect } from "vitest";
import { parseClaudeOutput } from "../src/lib/claude-output-parser.js";

describe("parseClaudeOutput", () => {
  it("parses result as string", () => {
    const json = JSON.stringify({
      result: "The answer is 42.",
      session_id: "s-123",
    });

    const result = parseClaudeOutput(json);
    expect(result.resultText).toBe("The answer is 42.");
    expect(result.sessionId).toBe("s-123");
    expect(result.errors).toHaveLength(0);
  });

  it("parses result with content array", () => {
    const json = JSON.stringify({
      result: {
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "World" },
        ],
      },
    });

    const result = parseClaudeOutput(json);
    expect(result.resultText).toBe("Hello \nWorld");
  });

  it("falls back to raw text when JSON parsing fails", () => {
    const result = parseClaudeOutput("This is plain text output");
    expect(result.resultText).toBe("This is plain text output");
    expect(result.errors).toHaveLength(0);
  });

  it("handles empty output", () => {
    const result = parseClaudeOutput("");
    expect(result.resultText).toBe("");
    expect(result.errors).toContain("Empty output from Claude CLI");
  });

  it("extracts error field", () => {
    const json = JSON.stringify({
      error: "Authentication failed",
      result: "",
    });

    const result = parseClaudeOutput(json);
    expect(result.errors).toContain("Authentication failed");
  });

  it("extracts cost_usd", () => {
    const json = JSON.stringify({
      result: "Done",
      cost_usd: 0.05,
    });

    const result = parseClaudeOutput(json);
    expect(result.costUsd).toBe(0.05);
  });

  it("handles nested error object", () => {
    const json = JSON.stringify({
      error: { message: "Rate limit exceeded", code: 429 },
    });

    const result = parseClaudeOutput(json);
    expect(result.errors).toContain("Rate limit exceeded");
  });

  it("stringifies response when no result field found", () => {
    const json = JSON.stringify({ data: "some unexpected format" });

    const result = parseClaudeOutput(json);
    expect(result.resultText).toContain("some unexpected format");
  });
});
