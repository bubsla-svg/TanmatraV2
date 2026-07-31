import { test, expect } from "@playwright/test";

/**
 * Visual regression for the global chrome, across the viewport matrix.
 *
 * HOW THE MATRIX WORKS
 * --------------------
 * There is no per-viewport `test()` in this file and there should not be.
 * Playwright already suffixes every snapshot with the project name and
 * platform, so `toHaveScreenshot("global-header.png")` resolves to
 * `global-header-<project>-<platform>.png`. The matrix therefore lives in
 * `playwright.config.ts`'s `projects` array — `chromium`, `mobile`, `vp-375`,
 * `vp-1024`, `vp-1440` — and every project that runs this file gets its own
 * independent baseline for free. Adding a width means adding a project, not
 * editing this spec.
 *
 * BASELINE STATUS — READ BEFORE ASSUMING COVERAGE
 * -----------------------------------------------
 * `BASELINED_PROJECTS` below is the honest, explicit record of which projects
 * actually have committed PNGs in `layout-vrt.spec.ts-snapshots/`. A project
 * that is not listed SKIPS with a loud, named reason rather than failing on a
 * missing baseline — a missing baseline failing the run is exactly what used to
 * keep the storefront job red.
 *
 * This is deliberately a hand-maintained allowlist and not a filesystem probe:
 * a probe would silently start "covering" a project the moment someone dropped
 * a PNG in, with nothing to review. Adding a name here is a visible line in a
 * PR, sitting next to the binary it vouches for.
 *
 * TO BASELINE A NEW PROJECT — must be done on a Linux CI runner. Font
 * rasterisation differs off-runner, so PNGs generated on a laptop or in an
 * agent sandbox fail in CI; do not commit those.
 *
 *   VRT_UPDATE_BASELINES=1 pnpm exec playwright test \
 *     --config artifacts/storefront/e2e/playwright.config.ts \
 *     specs/layout-vrt.spec.ts --project=<name> --update-snapshots
 *
 * Then commit the generated PNGs AND add `<name>` to BASELINED_PROJECTS in the
 * same PR. Doing one without the other is the failure mode this note exists to
 * prevent.
 */

/**
 * Projects with committed baselines today: `chromium` only.
 *
 * `mobile`, `vp-375`, `vp-1024` and `vp-1440` are wired into the matrix but are
 * NOT yet baselined — the snapshot directory holds exactly
 * `global-header-chromium-linux.png` and `global-footer-chromium-linux.png`.
 * Each needs one CI run with `--update-snapshots` (see above) before it asserts
 * anything. Until then this spec reports them as skipped, by name, on every
 * run. It does not pretend they pass.
 */
const BASELINED_PROJECTS: ReadonlySet<string> = new Set(["chromium"]);

/** Set when generating baselines, so an un-baselined project actually runs. */
const UPDATING = process.env["VRT_UPDATE_BASELINES"] === "1";

test.describe("Visual Regression Tests: Global Chrome", () => {
  test.beforeEach(({}, testInfo) => {
    const project = testInfo.project.name;
    test.skip(
      !UPDATING && !BASELINED_PROJECTS.has(project),
      `No committed VRT baseline for project "${project}". Generate it on a ` +
        `Linux runner: VRT_UPDATE_BASELINES=1 ... --project=${project} ` +
        `--update-snapshots, commit the PNGs, and add "${project}" to ` +
        `BASELINED_PROJECTS in this spec.`,
    );
  });

  test("Global header appearance", async ({ page }) => {
    await page.goto("/");
    // Ensure fonts and images are loaded
    await page.waitForLoadState("networkidle");
    const header = page.locator("header").first();

    // Assert visual parity with baseline
    await expect(header).toHaveScreenshot("global-header.png", {
      maxDiffPixels: 100, // allow minor anti-aliasing diffs
    });
  });

  test("Global footer appearance", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();

    // Assert visual parity with baseline
    await expect(footer).toHaveScreenshot("global-footer.png", {
      maxDiffPixels: 150,
    });
  });

  // Specifically check the Marketplace to ensure it doesn't drift
  // from the global layout
  test("Marketplace header matches global baseline", async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");
    const header = page.locator("header").first();

    await expect(header).toHaveScreenshot("global-header.png", {
      maxDiffPixels: 100,
    });
  });
});
