import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/scripts/seed.ts"],
  clean: true,
  dts: false,
  format: ["cjs"],
  sourcemap: true,
  splitting: false,
  outDir: "dist",
  noExternal: [/@er-triage\/shared/],
});
