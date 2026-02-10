import { describe, it, expect } from "vitest";
import {
  buildExplainCodePrompt,
  buildPlanPerfPrompt,
} from "../src/lib/prompt-builder.js";

describe("buildExplainCodePrompt", () => {
  it("builds a prompt with default depth", () => {
    const prompt = buildExplainCodePrompt({ target: "src/parser.rs" });
    expect(prompt).toContain("src/parser.rs");
    expect(prompt).toContain("detailed explanation");
    expect(prompt).toContain("Purpose");
    expect(prompt).toContain("Control Flow");
  });

  it("builds an overview prompt", () => {
    const prompt = buildExplainCodePrompt({
      target: "src/parser.rs",
      depth: "overview",
    });
    expect(prompt).toContain("high-level overview");
  });

  it("builds a trace prompt", () => {
    const prompt = buildExplainCodePrompt({
      target: "src/parser.rs",
      depth: "trace",
    });
    expect(prompt).toContain("execution trace");
  });

  it("includes context when provided", () => {
    const prompt = buildExplainCodePrompt({
      target: "src/parser.rs",
      context: "This is part of the oxc project",
    });
    expect(prompt).toContain("oxc project");
  });
});

describe("buildPlanPerfPrompt", () => {
  it("builds a prompt with default metrics", () => {
    const prompt = buildPlanPerfPrompt({ target: "src/transform.rs" });
    expect(prompt).toContain("src/transform.rs");
    expect(prompt).toContain("latency");
    expect(prompt).toContain("memory");
    expect(prompt).toContain("Hot Path");
    expect(prompt).toContain("Bottleneck");
    expect(prompt).toContain("Optimization Plan");
  });

  it("includes custom metrics", () => {
    const prompt = buildPlanPerfPrompt({
      target: "src/transform.rs",
      metrics: ["throughput", "binary-size"],
    });
    expect(prompt).toContain("throughput");
    expect(prompt).toContain("binary-size");
  });

  it("includes constraints", () => {
    const prompt = buildPlanPerfPrompt({
      target: "src/transform.rs",
      constraints: "Must not increase binary size",
    });
    expect(prompt).toContain("Must not increase binary size");
  });

  it("includes context", () => {
    const prompt = buildPlanPerfPrompt({
      target: "src/transform.rs",
      context: "This function is called 10M times per parse",
    });
    expect(prompt).toContain("10M times per parse");
  });
});
