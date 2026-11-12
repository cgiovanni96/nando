import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest gira dalla root del workspace: la risoluzione deve leggere i
  // `paths` del tsconfig più vicino a ogni file (web, api, worker, packages).
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: [
            "apps/**/src/**/*.test.ts",
            "packages/**/src/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
          exclude: ["**/node_modules/**", "**/dist/**", "**/test/integration/**"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: [
            "apps/**/test/integration/**/*.test.ts",
            "packages/**/test/integration/**/*.test.ts",
          ],
          exclude: ["**/node_modules/**", "**/dist/**"],
          fileParallelism: false,
          globalSetup: ["./packages/platform/test/integration/global-setup.ts"],
          setupFiles: ["./packages/platform/test/integration/setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
