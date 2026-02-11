import { defineCommand } from "citty";
import {
  installClaudeAgent,
  installClaudeSkill,
  installCodexSkill,
  promptScope,
  resolveScope,
} from "../lib/installer.js";

export default defineCommand({
  meta: {
    name: "install",
    description: "Install skills and agents",
  },
  subCommands: {
    skill: defineCommand({
      meta: { name: "skill", description: "Install a bridge skill" },
      args: {
        target: {
          type: "positional",
          description:
            "Target platform: claude (installs /codex skill) or codex (installs /claude skill)",
          required: false,
        },
        global: { type: "boolean", description: "Install globally" },
        local: { type: "boolean", description: "Install locally to current project" },
      },
      async run({ args }) {
        const target = args.target ?? "claude";
        const scope = resolveScope(args.global, args.local) ?? (await promptScope());

        if (target === "claude") {
          console.log("Installing /codex skill for Claude Code...");
          await installClaudeSkill(scope);
        } else if (target === "codex") {
          console.log("Installing /claude skill for Codex...");
          await installCodexSkill(scope);
        } else {
          console.error(`Unknown target: ${target}. Use "claude" or "codex".`);
          process.exit(1);
        }
      },
    }),
    agent: defineCommand({
      meta: { name: "agent", description: "Install the codex-teammate agent for Claude Code" },
      args: {
        global: { type: "boolean", description: "Install globally to ~/.claude/agents/" },
        local: { type: "boolean", description: "Install locally to .claude/agents/" },
      },
      async run({ args }) {
        const scope = resolveScope(args.global, args.local) ?? (await promptScope());
        console.log("Installing codex-teammate agent for Claude Code...");
        await installClaudeAgent(scope);
      },
    }),
  },
});
