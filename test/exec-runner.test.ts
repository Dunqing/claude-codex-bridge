import { describe, it, expect } from "vitest";
import { execCommand } from "../src/lib/exec-runner.js";

describe("execCommand", () => {
  it("captures stdout from a simple command", async () => {
    const result = await execCommand({
      command: "echo",
      args: ["hello world"],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.timedOut).toBe(false);
  });

  it("captures stderr", async () => {
    const result = await execCommand({
      command: "sh",
      args: ["-c", "echo error >&2"],
    });
    expect(result.stderr.trim()).toBe("error");
  });

  it("reports non-zero exit code", async () => {
    const result = await execCommand({
      command: "sh",
      args: ["-c", "exit 42"],
    });
    expect(result.exitCode).toBe(42);
    expect(result.timedOut).toBe(false);
  });

  it("times out and kills long-running process", async () => {
    const result = await execCommand({
      command: "sleep",
      args: ["60"],
      timeoutMs: 200,
    });
    expect(result.timedOut).toBe(true);
  });

  it("throws BridgeError for missing command", async () => {
    await expect(
      execCommand({
        command: "nonexistent_command_xyz_12345",
        args: [],
      }),
    ).rejects.toThrow("not found");
  });

  it("respects cwd option", async () => {
    const result = await execCommand({
      command: "pwd",
      args: [],
      cwd: "/tmp",
    });
    // macOS resolves /tmp to /private/tmp
    expect(result.stdout.trim()).toMatch(/\/tmp$/);
  });

  it("passes custom env vars", async () => {
    const result = await execCommand({
      command: "sh",
      args: ["-c", "echo $TEST_VAR"],
      env: { TEST_VAR: "bridge_test" },
    });
    expect(result.stdout.trim()).toBe("bridge_test");
  });

  it("increments BRIDGE_DEPTH in child env", async () => {
    const result = await execCommand({
      command: "sh",
      args: ["-c", "echo $BRIDGE_DEPTH"],
    });
    // Current depth is 0 (or whatever test env has), child should be +1
    const depth = parseInt(result.stdout.trim(), 10);
    expect(depth).toBeGreaterThanOrEqual(1);
  });
});
