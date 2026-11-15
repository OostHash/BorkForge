import { defineConfig, devices } from "@playwright/test";

// Visual regression and a11y checks against the frontend in browser mode
// (mock.html with mocked Tauri IPC).
export default defineConfig({
  testDir: "tests",
  testMatch: ["visual/**/*.spec.ts", "a11y/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixels: 50, animations: "disabled" },
  },
  use: {
    baseURL: "http://localhost:1430",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: {
    command: "pnpm exec vite --port 1430",
    url: "http://localhost:1430/mock.html",
    reuseExistingServer: !process.env.CI,
  },
});
