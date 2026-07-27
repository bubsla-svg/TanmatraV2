import { defineConfig, devices } from "@playwright/test";

// TNM-SF-01 §6: one spec per CUJ, env-driven base URL — the same specs run
// against a local prod build now and the deployed Cloud Run service URL at
// each wave gate (never localhost-only, never live traffic pre-cutover).
//   E2E_BASE_URL=https://storefront-<...>.run.app pnpm exec playwright test \
//     --config artifacts/storefront/e2e/playwright.config.ts --project=mobile
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 2 : undefined,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL: BASE_URL,
    // Sandbox/CI escape hatch: point at a pre-installed browser build.
    ...(process.env["E2E_CHROMIUM_PATH"]
      ? { launchOptions: { executablePath: process.env["E2E_CHROMIUM_PATH"] } }
      : {}),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The storefront is mobile-first (§4); the wave gates run this project.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
