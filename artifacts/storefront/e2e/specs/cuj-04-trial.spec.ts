import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";

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
  await expect(page.getByRole("heading", { name: /try three lunches for ₹399/i })).toBeVisible();
  // The creditback promise and the no-auto-renew guarantee, verbatim spine copy.
  await expect(page.getByText(/comes back as credit/i).first()).toBeVisible();
  await expect(page.getByText(/never auto-renews/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /start with 3 lunches/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("start hands off to checkout carrying the trial plan + chosen track", async ({ page }) => {
  await page.goto("/trial");
  await page.getByRole("button", { name: "Non-veg" }).click();
  await page.getByRole("button", { name: /start with 3 lunches/i }).click();
  await page.waitForURL(/\/checkout\?plan=trial_3day&track=nonveg/);
});

// DEF-RECON-TRIALCTA-001 (docs/reconciliation/defects.md): the Start CTA used
// to hide once the cart held an item, on the assumption that MiniCartBar
// would take over the bottom edge — but /trial lives under app/(focus)/,
// whose FocusLayout never mounts one. A customer who added a dish from /menu
// first, then came to /trial, saw no way to start the trial at all.
test("the start CTA stays visible and clickable even with items already in cart", async ({ page }) => {
  const menu = new MenuPage(page);
  await page.goto("/menu");
  await menu.addToCart();

  await page.goto("/trial");
  const startCta = page.getByRole("button", { name: /start with 3 lunches/i });
  await expect(startCta).toBeVisible();
  await startCta.click();
  await page.waitForURL(/\/checkout\?plan=trial_3day&track=veg/);
});

// Deployed-only (E2E_LIVE_CHECKOUT=1): the local PR-gate build is flag-dark,
// so /checkout renders the skeleton flow there instead of the live PlanCheckout.
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("trial checkout gates on identity before collecting the profile", async ({ page }) => {
  await page.goto("/checkout?plan=trial_3day&track=veg");
  await expect(page.getByRole("heading", { name: /start your 3-day taste test/i })).toBeVisible();
  await expect(page.getByText(/sign in to set up delivery/i)).toBeVisible();
});
