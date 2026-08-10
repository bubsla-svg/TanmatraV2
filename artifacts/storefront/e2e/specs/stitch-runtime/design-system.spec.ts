import { test, expect } from "@playwright/test";
import { marker, evidenceShot } from "./support";

/**
 * Stitch-runtime evidence — §4 design-system reference screens.
 *
 * Both manifest entries live on the SAME route entry point
 * (app/(global)/styleguide/page.tsx): the page reads `?theme=` and stamps
 * data-screen-id 4.1 (dark, the default) or 4.2 (light) with
 * data-screen-state mirroring the theme. Assertions are role/name-first
 * (§9/§10) — the marker is supplementary, and the evidence screenshot is
 * always the last await so tools/record-stitch-evidence.mjs captures the
 * asserted state.
 */

test.describe("stitch-runtime: design system (4.x)", () => {
  test("4.1 dark styleguide is wired", async ({ page }) => {
    await page.goto("/styleguide");
    // Role/name-first: the first token section heading of the styleguide.
    await expect(
      page.getByRole("heading", { name: "CTAs & Buttons", exact: true }),
    ).toBeVisible();
    // Marker pinned to BOTH id and state — /styleguide without ?theme=light
    // must stamp the dark screen, never the light one.
    await expect(marker(page, "4.1", "dark")).toBeVisible();
    await evidenceShot(page, "4.1");
  });

  test("4.2 light styleguide is wired", async ({ page }) => {
    await page.goto("/styleguide?theme=light");
    await expect(
      page.getByRole("heading", { name: "CTAs & Buttons", exact: true }),
    ).toBeVisible();
    await expect(marker(page, "4.2", "light")).toBeVisible();
    await evidenceShot(page, "4.2", "light");
  });
});
