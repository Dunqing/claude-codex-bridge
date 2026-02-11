// All logging goes to stderr — stdout is the MCP JSON-RPC channel.

const isDebug = !!process.env["BRIDGE_DEBUG"];

type LogLevel = "info" | "warning" | "error" | "debug";

function log(level: LogLevel, msg: string, ...args: unknown[]): void {
  const prefix = `[${level.toUpperCase()}]`;
  console.error(`${prefix} ${msg}`, ...args);
}

// ---------------------------------------------------------------------------
// Progress notifications — rendered inline by Claude Code during tool calls.
// ---------------------------------------------------------------------------

export interface ProgressReporter {
  report(message: string): void;
}

export function createProgressReporter(
  sendNotification: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      message?: string;
    };
  }) => Promise<void>,
  progressToken: string | number | undefined,
): ProgressReporter | undefined {
  if (progressToken === undefined) return undefined;
  let step = 0;
  return {
    report(message: string) {
      step++;
      sendNotification({
        method: "notifications/progress",
        params: { progressToken, progress: step, message },
      }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export const logger = {
  info(msg: string, ...args: unknown[]) {
    log("info", msg, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    log("warning", msg, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    log("error", msg, ...args);
  },
  debug(msg: string, ...args: unknown[]) {
    if (isDebug) log("debug", msg, ...args);
  },
};
