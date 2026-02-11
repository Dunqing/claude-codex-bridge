import { defineCommand } from "citty";
import {
  installClaudeAgent,
  installClaudeSkill,
  installCodexSkill,
  promptScope,
  resolveScope,
  setupClaude,
  setupCodex,
} from "../lib/installer.js";

export default defineCommand({
  meta: {
    name: "setup",
    description: "Set up claude-codex-bridge for Claude Code and/or Codex CLI",
  },
  args: {
    target: {
      type: "positional",
      description: "Target to set up: claude, codex, or both",
      required: false,
    },
    global: { type: "boolean", description: "Install extras globally" },
    local: { type: "boolean", description: "Install extras locally to current project" },
    "skip-extras": { type: "boolean", description: "Skip installing skill and agent" },
  },
  async run({ args }) {
    const target = args.target ?? "both";

    if (target !== "claude" && target !== "codex" && target !== "both") {
      console.error(`Unknown target: ${target}. Use "claude", "codex", or "both".`);
      process.exit(1);
    }

    if (target === "both" || target === "claude") {
      await setupClaude();
    }
    if (target === "both" || target === "codex") {
      await setupCodex();
    }

    if (args["skip-extras"]) return;

    const scope = resolveScope(args.global, args.local) ?? (await promptScope());

    if (target === "both" || target === "claude") {
      console.log("\nInstalling extras for Claude Code...");
      await installClaudeSkill(scope);
      await installClaudeAgent(scope);
    }

    if (target === "both" || target === "codex") {
      console.log("\nInstalling extras for Codex...");
      await installCodexSkill(scope);
    }

    console.log("\nSetup complete! Restart Claude Code and/or Codex for changes to take effect.");
  },
});
