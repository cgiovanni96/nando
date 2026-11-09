import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    migrate: "src/migrate.ts",
  },
  format: "esm",
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  deps: {
    alwaysBundle: [/.*/],
    onlyBundle: false,
  },
});
