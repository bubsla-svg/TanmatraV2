import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH } from "../fixtures";

/**
 * The STANDALONE dish PDP (`/dish/[slug]`) — the surface that had no e2e
 * coverage at all, and where a guest-purchase dead end shipped undetected.
 *
 * CUJ-01 already covers the *other* PDP: the `/menu?dish=<slug>` bottom
 * sheet. That one lives in `app/(global)/`, so it inherits Header +
 * MiniCartBar and its route into checkout comes for free. `/dish/[slug]` is a
 * different page in a different shell — `app/(focus)/`, which renders no
 * Header, no MobileBottomNav and no MiniCartBar on the rule that each focus
 * flow owns its own bottom edge. Nothing exercised it, so nothing caught that
 * adding a dish there left the visitor with a stepper and no way to the cart.
 *
 * `support/routes.ts` excludes parameterised routes from the generic sweep,
 * which is why this needs its own spec rather than a list entry.
 *
 * Runs against the live-or-fallback catalog like the rest of the suite;
 * ORDERABLE_DISH is an à-la-carte hero, so it is present in both tiers.
 *
 * Dual-target, same convention as CUJ-01's drawer leg: the PR-gate build is
 * flag-dark (NEXT_PUBLIC_LIVE_CHECKOUT unset), where PdpCartLink renders the
 * LOUD "checkout goes live" status instead of a link; the deployed service is
 * flag-live, where the link is real. E2E_LIVE_CHECKOUT=1 selects which side
 * each assertion runs.
 */

const PDP = `/dish/${ORDERABLE_DISH.slug}`;
const liveCheckout = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

test("standalone PDP exposes a guest add-to-cart action", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(PDP);

  await expect(
    page.getByRole("heading", { name: ORDERABLE_DISH.name }),
  ).toBeVisible();

  // No session is established anywhere in this spec — guest checkout is
  // supported, so the purchase action must not be gated behind sign-in.
  const add = page.getByRole("button", { name: /^add$/i });
  await expect(add).toBeVisible();
  await expect(add).toBeEnabled();
  expect(errors).toEqual([]);
});

test("adding from the standalone PDP reveals a route to the cart", async ({ page }) => {
  await page.goto(PDP);

  // Pre-add: no cart affordance yet (the cart is empty, nothing to view).
  await expect(page.getByRole("link", { name: /view cart/i })).toBeHidden();

  await page.getByRole("button", { name: /^add$/i }).click();

  // §4.1: the stepper replaces Add in place — this is the qty>0 face of the
  // same control, NOT a separate quantity widget, and its presence means the
  // line is already in the cart.
  await expect(
    page.getByRole("group", { name: new RegExp(`${ORDERABLE_DISH.name} quantity`, "i") }),
  ).toBeVisible();

  // The regression this spec exists for: once the cart is non-empty the page
  // must offer a way ONWARD. Before PdpCartLink there was NOTHING here — no
  // cart link, no gated notice, no tab bar, no header — and browser Back was
  // the only exit. Flag-dark contract (§0.3, mirroring CUJ-01's drawer leg):
  // in the PR-gate build the affordance is the LOUD "checkout goes live"
  // status, never a link into a void; on the deployed flag-live service it
  // is the real link.
  if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
    const viewCart = page.getByRole("link", { name: /view cart/i });
    await expect(viewCart).toBeVisible();
    await expect(viewCart).toBeEnabled();
  } else {
    await expect(
      page.getByRole("status").filter({ hasText: /checkout goes live/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /view cart/i })).toHaveCount(0);
  }
});

// The checkout leg only exists where the live flag is built in — the deployed
// service, run with E2E_LIVE_CHECKOUT=1. Skipped (not vacuously passed) in the
// flag-dark PR-gate build, same as CUJ-01's live leg.
liveCheckout("guest can reach checkout from the standalone PDP", async ({ page }) => {
  await page.goto(PDP);
  await page.getByRole("button", { name: /^add$/i }).click();

  await page.getByRole("link", { name: /view cart/i }).click();

  await expect(page).toHaveURL(/\/checkout/);
});

test("the standalone PDP offers a way back out", async ({ page }) => {
  // FocusLayout's contract is that each focus flow supplies its own back
  // affordance, since the shell renders no Header. This page had none —
  // arriving from a protocol rail, a saved favourite or a search result left
  // browser Back as the only exit.
  await page.goto(PDP);

  await page.getByRole("link", { name: /back to menu/i }).click();

  await expect(page).toHaveURL(/\/menu$/);
});

test("the focus shell renders no global chrome on the PDP", async ({ page }) => {
  // The flip side of the bug: this page must NOT grow a tab bar or mini-cart
  // bar to solve the dead end — that would break the layout contract and
  // double up bottom bars. The fix belongs in the page's own sticky bar.
  await page.goto(PDP);
  await page.getByRole("button", { name: /^add$/i }).click();

  // MiniCartBar's "View cart" is a BUTTON (it opens the drawer); the PDP's
  // affordance is a LINK straight to checkout. Asserting on role keeps the
  // two distinguishable — if MiniCartBar ever mounts here, this fails.
  await expect(page.getByRole("button", { name: /view cart/i })).toBeHidden();
  await expect(page.getByRole("navigation", { name: /primary/i })).toBeHidden();
});
