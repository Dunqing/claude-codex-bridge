export type ExplainDepth = "overview" | "detailed" | "trace";
export type PerfMetric = "latency" | "throughput" | "memory" | "binary-size";

/**
 * Builds a prompt for deep code/logic explanation.
 */
export function buildExplainCodePrompt(options: {
  target: string;
  depth?: ExplainDepth;
  context?: string;
}): string {
  const depth = options.depth ?? "detailed";
  const depthInstructions: Record<ExplainDepth, string> = {
    overview:
      "Provide a high-level overview: what the code does, its role in the system, and key abstractions. Keep it concise.",
    detailed:
      "Provide a detailed explanation: purpose, control flow, data flow, key design decisions, edge cases, and how it interacts with surrounding code.",
    trace:
      "Provide a full execution trace: step through the code path, explain each branch, data transformation, and side effect. Include call chains and state mutations.",
  };

  let prompt = `Explain the following code/module/function in depth.\n\nTarget: ${options.target}\n\n${depthInstructions[depth]}`;

  if (options.context) {
    prompt += `\n\nAdditional context: ${options.context}`;
  }

  prompt += `\n\nStructure your response with:
1. **Purpose** - What this code does and why it exists
2. **Key Components** - Main functions, types, data structures
3. **Control Flow** - How execution proceeds
4. **Data Flow** - How data is transformed and passed
5. **Design Decisions** - Why it's structured this way
6. **Dependencies** - What it depends on and what depends on it`;

  return prompt;
}

/**
 * Builds a prompt for planning performance improvements.
 */
export function buildPlanPerfPrompt(options: {
  target: string;
  metrics?: PerfMetric[];
  constraints?: string;
  context?: string;
}): string {
  const metrics = options.metrics ?? ["latency", "memory"];
  const metricsList = metrics.join(", ");

  let prompt = `Analyze the performance of the following code and create a concrete improvement plan.

Target: ${options.target}

Focus metrics: ${metricsList}

Perform the following analysis:
1. **Current State** - Read and understand the target code
2. **Hot Path Analysis** - Identify the critical execution path and where time/memory is spent
3. **Bottleneck Identification** - List specific bottlenecks with evidence (e.g., unnecessary allocations, redundant computations, cache misses, algorithmic complexity)
4. **Optimization Plan** - For each bottleneck, propose a ranked optimization with:
   - Description of the change
   - Expected impact (quantified if possible)
   - Implementation difficulty (low/medium/high)
   - Any correctness risks or trade-offs
5. **Implementation Order** - Recommend which optimizations to apply first (highest impact, lowest risk)
6. **Measurement Plan** - How to verify each optimization works (benchmarks, profiling commands)`;

  if (options.constraints) {
    prompt += `\n\nConstraints: ${options.constraints}`;
  }

  if (options.context) {
    prompt += `\n\nAdditional context: ${options.context}`;
  }

  return prompt;
}
