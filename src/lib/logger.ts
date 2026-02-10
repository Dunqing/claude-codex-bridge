// All logging MUST go to stderr — stdout is the MCP JSON-RPC channel.
// When an MCP server is attached, logs are also sent via the MCP protocol
// so Claude Code can display them in real-time.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";

const isDebug = !!process.env["BRIDGE_DEBUG"];

let mcpServer: McpServer | null = null;

/** Attach an MCP server so log messages are sent via the protocol. */
export function setMcpServer(server: McpServer): void {
  mcpServer = server;
}

function log(level: LoggingLevel, msg: string, ...args: unknown[]): void {
  // Always write to stderr as a fallback.
  const prefix = `[${level.toUpperCase()}]`;
  console.error(`${prefix} ${msg}`, ...args);

  // Send via MCP protocol if a server is attached.
  if (mcpServer) {
    mcpServer.sendLoggingMessage({ level, data: msg }).catch(() => {
      // Swallow — server may not be connected yet.
    });
  }
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
): ProgressReporter {
  let step = 0;
  return {
    report(message: string) {
      if (progressToken === undefined) return;
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
