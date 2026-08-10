import { test, expect } from "@playwright/test";
import { collectErrors } from "../../fixtures";
import { marker, evidenceShot } from "./support";

/**
 * Stitch-runtime evidence — §6.9 quick-setup wizard (manifest 6.9.1 → 6.9.3).
 *
 * The three entries are wizard-stages of ONE client state machine
 * (components/wizard/QuickSetupWizard.tsx) on /quick-setup, reachable only by
 * real Continue clicks (manifest trigger: button "Continue" from the prior
 * stage) — so this is a single flow test, not three isolated ones. At each
 * stage: role/name assertion first, then the stage's diagnostic marker
 * (data-screen-id/-state), then the evidence screenshot. The tail walks Back
 * once and asserts the prior stage re-renders WITH its selection preserved
 * (the wizard's draft state, not a fresh mount).
 */

test.describe("stitch-runtime · quick-setup wizard", () => {
  test("6.9.1 6.9.2 6.9.3 quick-setup wizard stages are wired (one flow, back preserves state)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/quick-setup");
    await expect(page.getByRole("heading", { name: "3-Step Dietary Setup" })).toBeVisible();

    // — 6.9.1 step-1-goal —
    await expect(page.getByRole("button", { name: /fat loss & metabolic reset/i })).toBeVisible();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(marker(page, "6.9.1", "step-1-goal")).toBeVisible();
    await evidenceShot(page, "6.9.1");

    // Real trigger: pick a goal, then Continue (manifest transition CONTINUE).
    await page.getByRole("button", { name: /fat loss & metabolic reset/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // — 6.9.2 step-2-food-pattern —
    await expect(
      page.getByRole("heading", { name: /select dietary allergens our kitchen must strictly omit/i }),
    ).toBeVisible();
    await expect(marker(page, "6.9.2", "step-2-food-pattern")).toBeVisible();
    // Make a selection this stage owns, so the Back leg below can prove the
    // draft survives: Dairy's accessible name flips to "Dairy Excluding ✓".
    await page.getByRole("button", { name: /^dairy/i }).click();
    await expect(page.getByRole("button", { name: /dairy excluding/i })).toBeVisible();
    await evidenceShot(page, "6.9.2");

    await page.getByRole("button", { name: /continue/i }).click();

    // — 6.9.3 step-3-cadence —
    await expect(page.getByRole("button", { name: /strictly vegetarian/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /see customized menu/i })).toBeVisible();
    await expect(marker(page, "6.9.3", "step-3-cadence")).toBeVisible();
    await evidenceShot(page, "6.9.3");

    // Back once: step 2 re-renders and the Dairy exclusion chosen before is
    // still active — state preserved, not a reset wizard.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(marker(page, "6.9.2", "step-2-food-pattern")).toBeVisible();
    await expect(page.getByRole("button", { name: /dairy excluding/i })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
