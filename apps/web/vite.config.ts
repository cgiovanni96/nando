import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  logLevel: "error",
  server: {
    port: 3001,
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
  plugins: [tanstackStart({ srcDirectory: "src" }), viteReact(), nitro()],
});
