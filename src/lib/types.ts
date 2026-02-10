export const CODEX_MODELS = ["gpt-5.3-codex", "gpt-5.2-codex", "gpt-5.1-codex-max"] as const;

export type CodexModel = (typeof CODEX_MODELS)[number];

export const CLAUDE_MODELS = ["sonnet", "opus", "haiku"] as const;

export type ClaudeModel = (typeof CLAUDE_MODELS)[number];

export interface ExecOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  onStdout?: (chunk: Buffer | string) => void;
  onStderr?: (chunk: Buffer | string) => void;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface CodexResult {
  threadId: string | null;
  agentMessage: string;
  fileChanges: Array<{
    path: string;
    kind: string;
  }>;
  commandsExecuted: Array<{
    command: string;
    exitCode: number | null;
    output: string;
  }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
  errors: string[];
}

export interface ClaudeResult {
  resultText: string;
  sessionId: string | null;
  costUsd: number | null;
  errors: string[];
}
