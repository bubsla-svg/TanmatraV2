import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * SF-09 / CUJ-04 — the 3-Day Taste Test. The offer surface runs everywhere
 * (server-rendered, spine-priced); the live money leg mirrors cuj-02's pattern:
 * a full purchase needs a real session + a live Razorpay modal, neither
 * headlessly drivable, so on the deployed service we verify the trial enters
 * the SAME live plan checkout (identity gate first), carrying its track.
 */

test("trial page states the offer honestly — price, creditback, no auto-renew", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/trial");
  await expect(page.getByRole("heading", { name: /try 3 lunches for ₹399/i })).toBeVisible();
  // The creditback promise and the no-auto-renew guarantee, verbatim spine copy.
  await expect(page.getByText(/comes back as credit/i).first()).toBeVisible();
  await expect(page.getByText(/never auto-renews/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /start the taste test/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("start hands off to checkout carrying the trial plan + chosen track", async ({ page }) => {
  await page.goto("/trial");
  await page.getByRole("button", { name: "Non-veg" }).click();
  await page.getByRole("button", { name: /start the taste test/i }).click();
  await page.waitForURL(/\/checkout\?plan=trial_3day&track=nonveg/);
});

// Deployed-only (E2E_LIVE_CHECKOUT=1): the local PR-gate build is flag-dark,
// so /checkout renders the skeleton flow there instead of the live PlanCheckout.
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("trial checkout gates on identity before collecting the profile", async ({ page }) => {
  await page.goto("/checkout?plan=trial_3day&track=veg");
  await expect(page.getByRole("heading", { name: /start your 3-day taste test/i })).toBeVisible();
  await expect(page.getByText(/sign in to set up delivery/i)).toBeVisible();
});
