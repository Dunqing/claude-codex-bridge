export interface ExecOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
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
