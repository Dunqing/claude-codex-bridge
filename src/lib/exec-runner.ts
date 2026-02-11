import { spawn } from "node:child_process";
import { BridgeError } from "./errors.js";
import { logger } from "./logger.js";
import type { ExecOptions, ExecResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 600_000; // 10 minutes
const MAX_BRIDGE_DEPTH = 2;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 10_000;

function getTimeoutMs(): number {
  const env = process.env["BRIDGE_TIMEOUT_MS"];
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
}

function getMaxRetries(): number {
  const env = process.env["BRIDGE_MAX_RETRIES"];
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_MAX_RETRIES;
}

function checkRecursionDepth(): void {
  const depth = parseInt(process.env["BRIDGE_DEPTH"] ?? "0", 10);
  if (depth >= MAX_BRIDGE_DEPTH) {
    throw new BridgeError(
      `Maximum bridge nesting depth reached (${depth} >= ${MAX_BRIDGE_DEPTH}). This prevents infinite recursion between Claude and Codex.`,
      "RECURSION_LIMIT",
    );
  }
}

// ---------------------------------------------------------------------------
// Transient error detection
// ---------------------------------------------------------------------------

const TRANSIENT_PATTERNS = [
  "rate limit",
  "too many requests",
  "429",
  "500",
  "502",
  "503",
  "504",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "gateway timeout",
  "connection reset",
  "connection refused",
  "econnreset",
  "econnrefused",
  "etimedout",
  "network error",
  "fetch failed",
  "socket hang up",
];

export function isTransientError(result: ExecResult): boolean {
  if (result.exitCode === 0) return false;
  if (result.timedOut) return false;
  const stderr = result.stderr.toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => stderr.includes(pattern));
}

function retryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core exec (single attempt)
// ---------------------------------------------------------------------------

function execOnce(options: ExecOptions): Promise<ExecResult> {
  const timeoutMs = options.timeoutMs ?? getTimeoutMs();
  const currentDepth = parseInt(process.env["BRIDGE_DEPTH"] ?? "0", 10);

  const env: Record<string, string | undefined> = {
    ...process.env,
    ...options.env,
    BRIDGE_DEPTH: String(currentDepth + 1),
  };

  return new Promise((resolve, reject) => {
    logger.debug(
      `exec: ${options.command} ${options.args.join(" ")} (cwd: ${options.cwd ?? process.cwd()}, timeout: ${timeoutMs}ms)`,
    );

    let child;
    try {
      child = spawn(options.command, options.args, {
        cwd: options.cwd ?? process.cwd(),
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      reject(
        new BridgeError(
          `Failed to spawn "${options.command}": ${err instanceof Error ? err.message : String(err)}`,
          "CLI_NOT_FOUND",
        ),
      );
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let settled = false;

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      if (typeof options.onStdout === "function") {
        options.onStdout(chunk);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      if (typeof options.onStderr === "function") {
        options.onStderr(chunk);
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      logger.warn(`Process timed out after ${timeoutMs}ms, sending SIGTERM`);
      child.kill("SIGTERM");
      // Force kill after 5 seconds if still alive
      setTimeout(() => {
        if (!settled) {
          logger.warn("Process did not exit after SIGTERM, sending SIGKILL");
          child.kill("SIGKILL");
        }
      }, 5_000);
    }, timeoutMs);

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      settled = true;
      if (err.code === "ENOENT") {
        reject(
          new BridgeError(
            `"${options.command}" not found. Is it installed and on your PATH?`,
            "CLI_NOT_FOUND",
          ),
        );
      } else {
        reject(new BridgeError(`Process error: ${err.message}`, "PROCESS_ERROR", err.code));
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      settled = true;
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        timedOut,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Public API — exec with automatic retry on transient errors
// ---------------------------------------------------------------------------

export async function execCommand(options: ExecOptions): Promise<ExecResult> {
  checkRecursionDepth();

  const maxRetries = options.maxRetries ?? getMaxRetries();

  for (let attempt = 0; ; attempt++) {
    const result = await execOnce(options);

    if (attempt < maxRetries && isTransientError(result)) {
      const delay = retryDelayMs(attempt);
      logger.warn(
        `Transient error detected (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
      );
      await sleep(delay);
      continue;
    }

    return result;
  }
}
