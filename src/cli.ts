#!/usr/bin/env node
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "claude-codex-bridge",
    description: "Bidirectional MCP bridge between Claude Code and Codex CLI",
  },
  subCommands: {
    serve: () => import("./commands/serve.js").then((r) => r.default),
    setup: () => import("./commands/setup.js").then((r) => r.default),
    install: () => import("./commands/install.js").then((r) => r.default),
  },
});

runMain(main);
