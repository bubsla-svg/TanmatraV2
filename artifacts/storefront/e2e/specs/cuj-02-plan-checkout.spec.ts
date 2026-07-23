import { test, expect } from "@playwright/test";

/**
 * SF-07 / CUJ-02 — the live plan-subscription checkout. The full flow needs a
 * real session (Firebase OTP) + a live Razorpay modal, neither headlessly
 * drivable, so this verifies the IDENTITY GATE: a launchable plan renders the
 * sign-in-first surface (not the flag-dark skeleton, not a dead end).
 * Deployed-only (E2E_LIVE_CHECKOUT=1): the local PR-gate build is flag-dark, so
 * /checkout renders the skeleton CheckoutFlow instead of PlanCheckout there.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("plan checkout gates on identity before collecting the profile", async ({ page }) => {
  // desk_fuel is self-serve launchable (steady/glp1/teams are gated).
  await page.goto("/checkout?plan=desk_fuel");
  await expect(page.getByRole("heading", { name: /start your .* plan/i })).toBeVisible();
  await expect(page.getByText(/sign in to set up delivery/i)).toBeVisible();
});
