export type BridgeErrorCode =
  | "CLI_NOT_FOUND"
  | "API_KEY_MISSING"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "PROCESS_ERROR"
  | "RECURSION_LIMIT";

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly code: BridgeErrorCode,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}
