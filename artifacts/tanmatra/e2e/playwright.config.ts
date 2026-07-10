import { defineConfig, devices } from "@playwright/test";

// Base URLs are env-driven so the same specs run against local dev, a preview
// Cloud Run revision, or production. Defaults point at local dev + the prod API.
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:5190";

export default defineConfig({
  testDir: "./specs",
  // Deterministic, CI-friendly defaults.
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 2 : undefined,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Scenario 11 (guest auth-guard) + mobile IA checks benefit from a
    // separate incognito-style context; Playwright contexts are already
    // isolated, so this is just an explicit mobile projection.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
