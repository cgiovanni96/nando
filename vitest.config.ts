import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "**/test/integration/**"],
        },
      },
    ],
  },
});
