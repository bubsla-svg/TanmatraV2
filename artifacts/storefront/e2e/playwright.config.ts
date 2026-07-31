import { defineConfig, devices } from "@playwright/test";

// TNM-SF-01 §6: one spec per CUJ, env-driven base URL — the same specs run
// against a local prod build now and the deployed Cloud Run service URL at
// each wave gate (never localhost-only, never live traffic pre-cutover).
//   E2E_BASE_URL=https://storefront-<...>.run.app pnpm exec playwright test \
//     --config artifacts/storefront/e2e/playwright.config.ts --project=mobile
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

/**
 * VRT viewport matrix (WEB-APP-ENHANCEMENT-PLAN Tier 2 #15).
 *
 * Three explicit breakpoint widths on top of the existing `chromium`
 * (1280x720 Desktop Chrome) and `mobile` (Pixel 7) pair:
 *
 *   vp-375   small mobile — the narrowest width the storefront claims to
 *            support, below Tailwind's `sm` (640px).
 *   vp-1024  the `lg` boundary itself — the single most breakage-prone width,
 *            because it is where the layout flips between stacked and
 *            multi-column.
 *   vp-1440  large desktop — wider than `chromium`'s 1280, so max-width
 *            containers and the wide-screen whitespace actually get exercised.
 *
 * SCOPE BOUND, STATED EXPLICITLY (AGENT_WORKING_AGREEMENT §6 — no silent
 * truncation): these three run ONLY `layout-vrt.spec.ts`, not the whole CUJ
 * suite. They exist to widen *visual* coverage; re-running 14 functional specs
 * three more times would roughly triple e2e wall-clock for signal the
 * `chromium`/`mobile` pair already gives. Widening them is a one-line change
 * to VIEWPORT_SPECS below — do it deliberately, with the CI time budget in hand.
 */
const VIEWPORT_SPECS = /layout-vrt\.spec\.ts/;

/**
 * Cross-browser bound, also explicit. Firefox and WebKit run the PRIMARY
 * FUNNEL SPEC ONLY (`core-funnel.spec.ts`) — not the full suite, and not the
 * VRT spec (per-engine font rasterisation would need its own baseline set per
 * engine, a much larger commitment than this plan item).
 *
 * They are also NOT part of the per-PR job: `.github/workflows/storefront.yml`
 * runs them in a separate nightly `cross-browser-nightly` job. Chromium-family
 * engines catch the large majority of storefront regressions; paying Gecko +
 * WebKit wall-clock on every PR is not worth it, and the plan says so.
 */
const CROSS_BROWSER_SPECS = /core-funnel\.spec\.ts/;

/**
 * Sandbox/CI escape hatch: point at a pre-installed browser build.
 * Spread into the CHROMIUM-FAMILY projects only — it used to sit in the shared
 * top-level `use`, which was harmless while chromium was the only engine, but
 * would now hand a Chromium binary to the firefox/webkit projects below and
 * fail them instantly.
 */
const CHROMIUM_LAUNCH = process.env["E2E_CHROMIUM_PATH"]
  ? { launchOptions: { executablePath: process.env["E2E_CHROMIUM_PATH"] } }
  : {};

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
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    // --- Full-suite projects (unchanged) ------------------------------------
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...CHROMIUM_LAUNCH } },
    // The storefront is mobile-first (§4); the wave gates run this project.
    { name: "mobile", use: { ...devices["Pixel 7"], ...CHROMIUM_LAUNCH } },

    // --- Viewport matrix: VRT spec only -------------------------------------
    // Chromium engine with an overridden viewport. These are *viewport*
    // projects, not device emulations — no touch, no mobile UA — so what they
    // exercise is purely CSS breakpoint behaviour at that width. Playwright
    // suffixes snapshots with the project name, so each gets its own baseline
    // (e.g. global-header-vp-375-linux.png) with no extra wiring in the spec.
    {
      name: "vp-375",
      testMatch: VIEWPORT_SPECS,
      use: { ...devices["Desktop Chrome"], ...CHROMIUM_LAUNCH, viewport: { width: 375, height: 812 } },
    },
    {
      name: "vp-1024",
      testMatch: VIEWPORT_SPECS,
      use: { ...devices["Desktop Chrome"], ...CHROMIUM_LAUNCH, viewport: { width: 1024, height: 800 } },
    },
    {
      name: "vp-1440",
      testMatch: VIEWPORT_SPECS,
      use: { ...devices["Desktop Chrome"], ...CHROMIUM_LAUNCH, viewport: { width: 1440, height: 900 } },
    },

    // --- Cross-browser: primary funnel only, nightly ------------------------
    {
      name: "firefox",
      testMatch: CROSS_BROWSER_SPECS,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: CROSS_BROWSER_SPECS,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
