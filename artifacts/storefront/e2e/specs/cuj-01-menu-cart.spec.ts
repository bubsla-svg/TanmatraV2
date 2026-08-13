import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";
import { CartDrawer } from "../support/pages/CartDrawer";

/**
 * CUJ-01 (browse → PDP → cart), the shipped half of the à-la-carte money
 * path. The checkout/pay legs extend this spec when SF-05 wires them; until
 * then the spec asserts the flag-dark state is LOUD, not silently dead.
 */

test("menu renders the à-la-carte grid with live-or-fallback data", async ({ page }) => {
  const errors = collectErrors(page);
  const menu = new MenuPage(page);
  await menu.goto();
  // The menu is à-la-carte ONLY (owner decision): the grid shows just the
  // orderable hero set — 42 in the api-less fallback build (static tier),
  // 71 against the live catalog. Assert a healthy floor, not an exact count,
  // so a curated add/remove doesn't break the spec.
  expect(await menu.dishCardLinks.count()).toBeGreaterThan(35);
  expect(errors).toEqual([]);
});

test("dish card opens the PDP bottom sheet; deep-link + back behave", async ({ page }) => {
  const menu = new MenuPage(page);
  await page.goto("/menu");
  await menu.cardLink().click();
  // Vaul drawer with a real DrawerTitle (§6 a11y).
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(ORDERABLE_DISH.name)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`dish=${ORDERABLE_DISH.slug}`));
  // Escape closes the sheet and rewrites the URL back to /menu.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/menu$/);
});

test("one-tap add → stepper in place → mini-bar; cart survives reload", async ({ page }) => {
  const errors = collectErrors(page);
  const menu = new MenuPage(page);
  await page.goto("/menu");

  await menu.addToCart();

  // §4.1: quantity stepper replaces Add in place.
  await expect(menu.quantityStepper()).toBeVisible();

  // Mini-bar appears with count + display subtotal.
  await expect(menu.itemCount(1)).toBeVisible();
  await menu.increaseQuantity();
  await expect(menu.itemCount(2)).toBeVisible();

  // Guarded persistence: reload keeps the cart.
  await page.reload();
  await expect(menu.itemCount(2)).toBeVisible();
  expect(errors).toEqual([]);
});

test("cart drawer shows lines + subtotal; dark checkout fails LOUD, never dead", async ({ page }) => {
  const menu = new MenuPage(page);
  const cart = new CartDrawer(page);
  await page.goto("/menu");
  await menu.addToCart();
  await menu.openCart();

  await expect(cart.title).toBeVisible();
  await expect(cart.line(ORDERABLE_DISH.name)).toBeVisible();
  await expect(cart.subtotal).toBeVisible();

  // Flag-dark contract (§0.3): a VISIBLE status explains checkout is gated —
  // and no "Checkout" CTA exists to click into a void. When SF-05 lands and
  // NEXT_PUBLIC_LIVE_CHECKOUT=1 is built in, this branch flips to asserting
  // the live checkout leg instead.
  if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
    await expect(cart.checkoutLink).toBeVisible();
  } else {
    await expect(cart.gatedStatus).toContainText(/checkout goes live/i);
    await expect(cart.checkoutLink).toHaveCount(0);
  }
});

// The à-la-carte checkout leg (SF-05) only exists where the live flag is built
// in — i.e. the deployed service, run with E2E_LIVE_CHECKOUT=1. In the flag-dark
// PR-gate build the CTA is absent, so this leg is skipped rather than asserting
// a surface that isn't there.
const liveCheckout = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

liveCheckout("cart → live à-la-carte checkout renders the guest details form", async ({ page }) => {
  const menu = new MenuPage(page);
  const cart = new CartDrawer(page);
  await page.goto("/menu");
  await menu.addToCart();
  await menu.openCart();
  await cart.checkoutLink.click();

  await expect(page).toHaveURL(/\/checkout\?mode=alacarte/);
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  // The DPDP consent the server hard-requires (400 consent_required) is present.
  await expect(page.getByText(/process my dietary and health details/i)).toBeVisible();
  // The pay CTA exists and is amount-free — the server owns the total — and it
  // stays disabled until the form is valid: never a dead button into a void.
  const pay = page.getByRole("button", { name: "Continue to payment" });
  await expect(pay).toBeVisible();
  await expect(pay).toBeDisabled();
});

test("every menu card is orderable — Add CTA on all cards, zero dead ends", async ({ page }) => {
  const menu = new MenuPage(page);
  await page.goto("/menu");
  // À-la-carte-only grid: a card without an Add CTA is a browse-only dead
  // end, which the menu no longer ships. Count parity is the invariant.
  const total = await menu.dishCardLinks.count();
  expect(total).toBeGreaterThan(35);
  // Polled, not a bare read. The two locators do not share a basis:
  // dishCardLinks is raw CSS (every card in the DOM) while addButtons is a
  // role query (the accessibility tree). Rows below the fold sit under
  // `content-visibility: auto` containment, so immediately after load the
  // second count can still be catching up with the first — this assertion
  // flaked exactly once under full-suite parallel load, never in isolation.
  // The invariant is unchanged and still strict: parity must hold, and a card
  // that genuinely ships without an Add still fails after the timeout.
  await expect.poll(() => menu.addButtons.count()).toBe(total);
});
