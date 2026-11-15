import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { prepaintScript } from "./src/state/prepaint";

/** Injects the pre-paint script as the first thing in <head> (plan 6.10). */
const prepaint = (): Plugin => ({
  name: "ff-prepaint",
  transformIndexHtml: () => [{ tag: "script", children: prepaintScript(), injectTo: "head-prepend" }],
});

const host = process.env.TAURI_DEV_HOST;

// Production frontend for the Tauri desktop application. mock.html remains a
// browser-only development and test harness.
export default defineConfig({
  plugins: [prepaint(), react(), tailwindcss()],
  clearScreen: false,

  // Only index.html is a build input. mock.html (mocked Tauri IPC) is dev-only.
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL("./index.html", import.meta.url)),
    },
  },

  // Crawl all sources (dynamic imports included) so every dependency is
  // pre-bundled up front; otherwise Vite re-optimizes on first use of a dev
  // page and serves "504 Outdated Optimize Dep".
  optimizeDeps: {
    entries: ["index.html", "mock.html", "src/**/*.{ts,tsx}"],
  },

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["../backend/**"] },
  },
});
