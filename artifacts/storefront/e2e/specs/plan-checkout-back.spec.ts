import { test, expect } from "@playwright/test";

/**
 * D-16 — plan checkout step 1 had no way back to the builder; browser Back
 * was the only exit, and it silently reset the track/cycle the customer had
 * just picked (verified empirically before this fix: selecting "Non-veg",
 * continuing to checkout, then going back via plain `page.goBack()` restored
 * the DEFAULT "Veg", not the customer's actual choice — plain history
 * navigation remounts PlanBuilder with fresh useState defaults; it does not
 * by itself preserve React state the way it might look like it should).
 *
 * The fix has two parts, both exercised here: FocusHeader's "Back to plan"
 * affordance (components/checkout/AlacarteDetails' own "Back to cart"
 * pattern — real router.back(), not a fresh push), and a sessionStorage
 * draft (components/plans/PlanBuilder.tsx, keyed per-plan) that restores the
 * track/cycle/bump choices across the remount a bare back-navigation would
 * otherwise lose.
 *
 * DEPLOYED-ONLY (E2E_LIVE_CHECKOUT=1): PlanCheckout/FocusHeader only render
 * on this route when NEXT_PUBLIC_LIVE_CHECKOUT was set at build time — the
 * PR-gate build falls back to the legacy CheckoutFlow component instead
 * (verified: this exact assertion failed against the flag-dark build, with
 * "Back to plan" simply not present). Stops at PlanIdentityGate deliberately
 * — reaching PlanDetails needs real Firebase phone-OTP auth, which has no
 * test hook in this wave (that's C2, a separate branch); the back affordance
 * and the draft restore are both fully exercised without going further,
 * since PlanIdentityGate is the FIRST screen "step 1" lands on.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("back from plan checkout returns to the builder with the picked track intact", async ({ page }) => {
  await page.goto("/plan/desk_fuel");
  const trackGroup = page.locator('[role="group"][aria-labelledby="pref-label"] button');
  const trackCount = await trackGroup.count();
  expect(trackCount, "desk_fuel must serve more than one track for this test to prove anything").toBeGreaterThan(1);

  // Pick a NON-default track — proves this is a real preserved choice, not a
  // coincidental match with whatever the server-computed default happens to be.
  await trackGroup.last().click();
  const picked = await page
    .locator('[role="group"][aria-labelledby="pref-label"] button[aria-pressed="true"]')
    .textContent();

  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout\?plan=desk_fuel/);

  // The back affordance itself — D-16's literal ask.
  const back = page.getByRole("button", { name: "Back to plan" });
  await expect(back).toBeVisible();
  await back.click();

  await expect(page).toHaveURL(/\/plan\/desk_fuel/);
  const restored = await page
    .locator('[role="group"][aria-labelledby="pref-label"] button[aria-pressed="true"]')
    .textContent();
  expect(restored, "the track picked before navigating away must survive the round trip").toBe(picked);
});
