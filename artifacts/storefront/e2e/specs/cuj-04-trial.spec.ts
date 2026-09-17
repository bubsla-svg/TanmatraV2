import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * T1 dead-funnel containment (CRO handoff 2026-09-17): with
 * NEXT_PUBLIC_PLAN_CHECKOUT unset at BUILD time (the PR-gate build, and
 * production until plans are live again), /trial sells the trio as three
 * à-la-carte cart lines at menu price and Start lands in the working guest
 * checkout. The subscription shape below is what the flag-on build restores.
 */
const PLANS_LIVE = process.env["NEXT_PUBLIC_PLAN_CHECKOUT"] === "1";
const START_LANDS_ON = PLANS_LIVE
  ? { veg: /\/checkout\?plan=trial_3day&track=veg/, nonveg: /\/checkout\?plan=trial_3day&track=nonveg/ }
  : { veg: /\/checkout\?mode=alacarte/, nonveg: /\/checkout\?mode=alacarte/ };

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
  await expect(page.getByRole("heading", { name: /try three lunches for ₹/i })).toBeVisible();
  if (PLANS_LIVE) {
    await expect(page.getByRole("heading", { name: /try three lunches for ₹399/i })).toBeVisible();
    // The creditback promise and the no-auto-renew guarantee, verbatim spine copy.
    await expect(page.getByText(/comes back as credit/i).first()).toBeVisible();
    await expect(page.getByText(/never auto-renews/i)).toBeVisible();
  } else {
    // No subscription promise may survive on the à-la-carte offer: no
    // creditback, no "never auto-renews" — and the one promise it does make.
    await expect(page.getByText(/comes back as credit/i)).toHaveCount(0);
    await expect(page.getByText(/nothing renews/i).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /start with 3 lunches/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("start hands off to checkout carrying the trial plan + chosen track", async ({ page }) => {
  await page.goto("/trial");
  await page.getByRole("button", { name: "Non-veg" }).click();
  await page.getByRole("button", { name: /start with 3 lunches/i }).click();
  await page.waitForURL(START_LANDS_ON.nonveg);
  if (!PLANS_LIVE) {
    // T1: the three dishes are in the cart as ordinary lines — the checkout
    // that opens is the working guest checkout, never the dark plan route.
    await expect(page.getByRole("heading", { name: /checkout/i }).first()).toBeVisible();
    await expect(page).not.toHaveURL(/plan=/);
  }
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
  await page.waitForURL(START_LANDS_ON.veg);
});

// Deployed-only (E2E_LIVE_CHECKOUT=1): the local PR-gate build is flag-dark,
// so /checkout renders the skeleton flow there instead of the live PlanCheckout.
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

deployedLive("trial checkout gates on identity before collecting the profile", async ({ page }) => {
  await page.goto("/checkout?plan=trial_3day&track=veg");
  await expect(page.getByRole("heading", { name: /start your 3-day taste test/i })).toBeVisible();
  await expect(page.getByText(/sign in to set up delivery/i)).toBeVisible();
});
