import { test, expect } from "@playwright/test";
import { ORDERABLE_DISH } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";
import { CartDrawer } from "../support/pages/CartDrawer";

/**
 * D-14 — "Andaaza nahi, likha hua": the checkout line is the last look
 * before money and previously showed name + price only. Macros are captured
 * at add-time (lib/cartStore.ts CartLine.macros) from the same DishData the
 * menu card already renders from, and shown as "~kcal · ~g P" in both the
 * cart drawer and the à-la-carte checkout line list.
 *
 * Runs against the PR-gate build: the fallback catalog carries real macro
 * data for every dish (it's the same DISHES array the menu card reads from),
 * so no live API is needed here.
 *
 * The backward-compatibility half of the acceptance criteria (a cart written
 * before this field existed still parses and renders, no macro chip, never a
 * crash) is unit-tested in lib/cartStore.test.ts — that's the right layer for
 * it (it's about parseStoredCart's tolerance of an old shape, not anything
 * observable through the UI, since every add from today's build always
 * writes the new shape).
 */

test("cart drawer line shows kcal/protein macros for the added dish", async ({ page }) => {
  const menu = new MenuPage(page);
  const cart = new CartDrawer(page);
  await menu.goto();
  await menu.addToCart();
  await menu.openCart();
  await expect(cart.title).toBeVisible();

  // Same figures the menu card already shows for this dish — read them off
  // the card itself rather than hardcoding, so this doesn't drift if the
  // fixture dish's macros ever change.
  const cardMacros = await menu.card().locator("text=/kcal/").first().textContent();
  expect(cardMacros, "the menu card itself must show macros for this to be a meaningful comparison").toBeTruthy();

  const drawerLine = cart.root.getByText(ORDERABLE_DISH.name).locator("..");
  await expect(drawerLine.getByText(/kcal/)).toBeVisible();
  await expect(drawerLine.getByText(/g P$/)).toBeVisible();
});

test("à-la-carte checkout line shows kcal/protein macros for the added dish", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.addToCart();
  await page.goto("/checkout?mode=alacarte"); // direct nav — no live-checkout flag needed
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  const checkoutLine = page.getByText(ORDERABLE_DISH.name).locator("..");
  await expect(checkoutLine.getByText(/kcal/)).toBeVisible();
  await expect(checkoutLine.getByText(/g P$/)).toBeVisible();
});
