import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/codex-server.ts", "src/claude-server.ts"],
  format: "esm",
  dts: true,
  clean: true,
});
