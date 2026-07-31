import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH, revealAllDishes } from "../fixtures";

/**
 * CUJ-01 (browse → PDP → cart), the shipped half of the à-la-carte money
 * path. The checkout/pay legs extend this spec when SF-05 wires them; until
 * then the spec asserts the flag-dark state is LOUD, not silently dead.
 */

test("menu renders the à-la-carte grid with live-or-fallback data", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/menu");
  await expect(page.getByRole("heading", { name: "The menu" })).toBeVisible();
  // The menu is à-la-carte ONLY (owner decision): the grid shows just the
  // orderable hero set — 42 in the api-less fallback build (static tier),
  // 71 against the live catalog. Assert a healthy floor, not an exact count,
  // so a curated add/remove doesn't break the spec.
  const cards = page.locator('a[href^="/menu?dish="]');
  expect(await cards.count()).toBeGreaterThan(35);
  expect(errors).toEqual([]);
});

test("dish card opens the PDP bottom sheet; deep-link + back behave", async ({ page }) => {
  await page.goto("/menu");
  await revealAllDishes(page);
  await page
    .locator('a[href="/menu?dish=' + ORDERABLE_DISH.slug + '"]')
    .first()
    .click();
  // Vaul drawer with a real DrawerTitle (§6 a11y).
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(ORDERABLE_DISH.name),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`dish=${ORDERABLE_DISH.slug}`));
  // Escape closes the sheet and rewrites the URL back to /menu.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/menu$/);
});

test("one-tap add → stepper in place → mini-bar; cart survives reload", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/menu");
  await revealAllDishes(page);

  const card = page.locator("article", { hasText: ORDERABLE_DISH.name }).first();
  await card.getByRole("button", { name: "Add" }).click();

  // §4.1: quantity stepper replaces Add in place.
  await expect(
    card.getByRole("group", { name: `${ORDERABLE_DISH.name} quantity` }),
  ).toBeVisible();

  // Mini-bar appears with count + display subtotal.
  await expect(page.getByText("1 item")).toBeVisible();
  await card.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByText("2 items")).toBeVisible();

  // Guarded persistence: reload keeps the cart.
  await page.reload();
  await expect(page.getByText("2 items")).toBeVisible();
  expect(errors).toEqual([]);
});

test("cart drawer shows lines + subtotal; dark checkout fails LOUD, never dead", async ({ page }) => {
  await page.goto("/menu");
  await revealAllDishes(page);
  const card = page.locator("article", { hasText: ORDERABLE_DISH.name }).first();
  await card.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "View cart" }).click();

  const drawer = page.getByRole("dialog");
  // "Your cart" as plain text is ambiguous — the fail-loud status also says
  // "…your cart is saved" (getByText is substring + case-insensitive). Use
  // the heading role for the title.
  await expect(drawer.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(drawer.getByText(ORDERABLE_DISH.name)).toBeVisible();
  await expect(drawer.getByText(/Subtotal \(before delivery & GST\)/)).toBeVisible();

  // Flag-dark contract (§0.3): a VISIBLE status explains checkout is gated —
  // and no "Checkout" CTA exists to click into a void. When SF-05 lands and
  // NEXT_PUBLIC_LIVE_CHECKOUT=1 is built in, this branch flips to asserting
  // the live checkout leg instead.
  if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
    await expect(drawer.getByRole("link", { name: "Checkout" })).toBeVisible();
  } else {
    await expect(drawer.getByRole("status")).toContainText(/checkout goes live/i);
    await expect(drawer.getByRole("link", { name: "Checkout" })).toHaveCount(0);
  }
});

// The à-la-carte checkout leg (SF-05) only exists where the live flag is built
// in — i.e. the deployed service, run with E2E_LIVE_CHECKOUT=1. In the flag-dark
// PR-gate build the CTA is absent, so this leg is skipped rather than asserting
// a surface that isn't there.
const liveCheckout = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

liveCheckout("cart → live à-la-carte checkout renders the guest details form", async ({ page }) => {
  await page.goto("/menu");
  await revealAllDishes(page);
  const card = page.locator("article", { hasText: ORDERABLE_DISH.name }).first();
  await card.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "View cart" }).click();

  const drawer = page.getByRole("dialog");
  await drawer.getByRole("link", { name: "Checkout" }).click();

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
  await page.goto("/menu");
  await revealAllDishes(page);
  const addButtons = page.getByRole("button", { name: "Add", exact: true });
  const cards = page.locator('a[href^="/menu?dish="]');
  // À-la-carte-only grid: a card without an Add CTA is a browse-only dead
  // end, which the menu no longer ships. Count parity is the invariant.
  const adds = await addButtons.count();
  const total = await cards.count();
  expect(total).toBeGreaterThan(35);
  expect(adds).toBe(total);
});
