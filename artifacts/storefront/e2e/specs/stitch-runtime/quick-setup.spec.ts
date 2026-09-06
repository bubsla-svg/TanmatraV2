import { test, expect } from "@playwright/test";
import { collectErrors } from "../../fixtures";
import { marker, evidenceShot } from "./support";

/**
 * Stitch-runtime evidence — §6.9 quick-setup wizard (manifest 6.9.1 → 6.9.3).
 *
 * Rebuilt under D-04B (TNM-CRO-01 owner ruling 2026-08-11): exactly three
 * one-question viewports — goal → dietary style → allergens — replacing the
 * old goal → allergens → (dietary style + conditions) order and its
 * disapproved "menu-matching + Sign in to save your profile" exit. The
 * business-logic contract (deterministic exit routing) is covered separately
 * in quicksetup-contract.spec.ts; this spec is visual/wiring evidence for the
 * three stages, same pattern as before: role/name assertion first, then the
 * stage's diagnostic marker, then the evidence screenshot. The tail walks
 * Back once and asserts the prior stage re-renders WITH its selection
 * preserved (the wizard's draft state, not a fresh mount).
 */

test.describe("stitch-runtime · quick-setup wizard", () => {
  test("6.9.1 6.9.2 6.9.3 quick-setup wizard stages are wired (one flow, back preserves state)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/quick-setup");
    await expect(page.getByRole("heading", { name: "3-Step Dietary Setup" })).toBeVisible();

    // — 6.9.1 step-1-goal —
    await expect(page.getByRole("radio", { name: /fat loss & metabolic reset/i })).toBeVisible();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
    await expect(marker(page, "6.9.1", "step-1-goal")).toBeVisible();
    await evidenceShot(page, "6.9.1");

    // Real trigger: pick a goal, then Continue (manifest transition CONTINUE).
    await page.getByRole("radio", { name: /fat loss & metabolic reset/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // — 6.9.2 step-2-dietary-style —
    await expect(page.getByRole("heading", { name: /what do you eat/i })).toBeVisible();
    await expect(marker(page, "6.9.2", "step-2-dietary-style")).toBeVisible();
    // Make a selection this stage owns, so the Back leg below can prove the
    // draft survives. SquircleOptionCard marks selection with a border-gold
    // class, not an accessible-name change — assert on that.
    const vegetarian = page.getByRole("radio", { name: /strictly vegetarian/i });
    await vegetarian.click();
    await expect(vegetarian).toHaveClass(/border-gold/);
    await evidenceShot(page, "6.9.2");

    await page.getByRole("button", { name: /continue/i }).click();

    // — 6.9.3 step-3-allergens —
    await expect(
      page.getByRole("heading", { name: /must leave out/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /see my plan/i })).toBeVisible();
    await expect(marker(page, "6.9.3", "step-3-allergens")).toBeVisible();
    await evidenceShot(page, "6.9.3");

    // Back once: step 2 re-renders and the vegetarian pick from before is
    // still selected — state preserved, not a reset wizard.
    // Scoped to the wizard: the route now carries a FocusHeader whose own
    // "Back" is the exit from /quick-setup, while THIS click means the
    // wizard's step-back. Both are correct and both are buttons named
    // "Back", so the selector has to say which one it means.
    await page.locator("section").getByRole("button", { name: "Back" }).click();
    await expect(marker(page, "6.9.2", "step-2-dietary-style")).toBeVisible();
    await expect(page.getByRole("radio", { name: /strictly vegetarian/i })).toHaveClass(/border-gold/);

    expect(errors).toEqual([]);
  });
});
