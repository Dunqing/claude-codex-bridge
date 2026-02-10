// All logging MUST go to stderr — stdout is the MCP JSON-RPC channel.
const isDebug = !!process.env["BRIDGE_DEBUG"];

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.error(`[INFO] ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    console.error(`[WARN] ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    console.error(`[ERROR] ${msg}`, ...args);
  },
  debug(msg: string, ...args: unknown[]) {
    if (isDebug) console.error(`[DEBUG] ${msg}`, ...args);
  },
};
