import { defineConfig, mergeConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Pre-bundle every dependency the browser tests touch. Otherwise Vite
    // discovers them mid-run, re-optimizes and reloads the test page, which
    // makes the first run after a dependency change fail at random.
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-dev-runtime",
        "react-aria-components",
        "@tanstack/react-query",
        "@tanstack/react-table",
        "@tanstack/react-virtual",
        "lucide-react",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
        "@tauri-apps/api/core",
        "@tauri-apps/api/event",
        "@tauri-apps/api/mocks",
        "@tauri-apps/api/webview",
        "@tauri-apps/api/window",
        "@tauri-apps/plugin-notification",
        "@tauri-apps/plugin-opener",
        "vitest-browser-react",
      ],
    },
    test: {
      projects: [
        {
          // Component and behaviour tests run in real Chromium: focus,
          // <dialog> and the Popover API do not behave realistically in jsdom.
          extends: true,
          test: {
            name: "browser",
            include: ["src/**/*.test.{ts,tsx}"],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
        {
          // Tooling tests (lint rules, token generation) run in Node.
          test: {
            name: "node",
            include: ["tests/tooling/**/*.test.ts"],
            environment: "node",
          },
        },
      ],
    },
  }),
);
