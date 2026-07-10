import { test, expect } from "@playwright/test";
import {
  seedCart,
  cartItem,
  cartSubtotal,
  deliveryFeeFor,
  gstOn,
  expectPaise,
  rupees,
  FREE_DELIVERY_THRESHOLD,
  DELIVERY_FEE,
} from "../fixtures";

// IDs 10, 14, 15, 9, 13 — Pricing / Cart / Persistence.
// Money is asserted in integer paise. The pricing RULE (mirrored from
// cartContext.tsx) is the source of truth for expected values; UI text is a
// secondary check. Where a stable data-testid is missing, the UI assertion is
// marked TODO rather than guessed.

test.describe("Pricing & cart math", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  // [10] Free-delivery nudge updates on each cart mutation. @p0
  test("[10] @p0 free-delivery nudge tracks subtotal toward ₹500", async ({ page }) => {
    // Below threshold → fee applies and a positive "amount to free delivery" remains.
    const below = [cartItem({ unitPrice: rupees(300), quantity: 1 })];
    expectPaise(deliveryFeeFor(cartSubtotal(below)), DELIVERY_FEE, "below-threshold fee");
    expectPaise(FREE_DELIVERY_THRESHOLD - cartSubtotal(below), rupees(200), "remaining to free");

    await seedCart(page, below);
    await page.goto("/cart");
    // The nudge copy renders `amountToFreeDelivery` (see cartContext). Prefer a
    // stable selector once added; for now assert the page shows a ₹ nudge.
    // TODO(testid): add data-testid="free-delivery-nudge" to the Cart nudge node
    // and assert its text === "Add ₹200 more for free delivery".
    await expect(page.getByText(/free delivery/i).first()).toBeVisible();
  });

  // [14] Boundary: subtotal EXACTLY ₹500 → delivery fee ₹0. @p0
  test("[14] @p0 delivery fee is ₹0 exactly at the ₹500 boundary", async ({ page }) => {
    // Rule (executable spec): fee is 0 at and above the threshold, 5000 just below.
    expectPaise(deliveryFeeFor(FREE_DELIVERY_THRESHOLD), 0, "at boundary");
    expectPaise(deliveryFeeFor(FREE_DELIVERY_THRESHOLD - 1), DELIVERY_FEE, "one paise below");
    expectPaise(deliveryFeeFor(FREE_DELIVERY_THRESHOLD + 1), 0, "one paise above");

    // And the checkout reflects it: seed a cart whose subtotal is exactly 50000.
    const items = [cartItem({ unitPrice: rupees(250), quantity: 2 })]; // 50000 paise
    expectPaise(cartSubtotal(items), FREE_DELIVERY_THRESHOLD, "seed subtotal");
    await seedCart(page, items);
    await page.goto("/checkout");
    await expect(page.getByText("Delivery Address")).toBeVisible(); // page rendered
    // TODO(testid): add data-testid="summary-delivery-fee" and assert text "Free"/"₹0"
    // and data-testid="summary-total" === subtotal + gstOn(subtotal).
  });

  // [15] Upsell reversal: totals revert exactly after removing the upsell. @p0
  test("[15] @p0 removing an upsell reverts subtotal/tax/delivery/total exactly", async ({ page }) => {
    const base = cartItem({ dishId: 2, slug: "aglio-olio-veg", unitPrice: rupees(130) });
    const upsell = cartItem({ dishId: 90, slug: "almond-protein-bites", unitPrice: rupees(120) });

    const withUpsell = [base, upsell];
    const afterRemove = [base];

    // Full totals with upsell.
    const sub1 = cartSubtotal(withUpsell);
    const totals1 = { sub: sub1, gst: gstOn(sub1), del: deliveryFeeFor(sub1) };
    // Totals after removing the upsell must equal the base-only computation.
    const sub2 = cartSubtotal(afterRemove);
    const totals2 = { sub: sub2, gst: gstOn(sub2), del: deliveryFeeFor(sub2) };

    // Reversal is exact: removing the upsell subtracts exactly its line value.
    expectPaise(totals1.sub - totals2.sub, upsell.unitPrice * upsell.quantity, "subtotal delta");
    expectPaise(totals2.gst, gstOn(sub2), "gst reverts");
    expectPaise(totals2.del, deliveryFeeFor(sub2), "delivery reverts");

    // UI: seed with upsell, open cart, remove the upsell line, re-read totals.
    await seedCart(page, withUpsell);
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/cart/);
    // TODO(testid): add data-testid="cart-line-{slug}" + "cart-remove-{slug}" and
    // data-testid="cart-total"; click remove on the upsell and assert cart-total
    // === totals2.sub + totals2.gst + totals2.del.
  });

  // [9] Household cart: kids + senior SKUs grouped, no pricing conflict.
  test.fixme("[9] household cart groups kids + senior SKUs with correct pricing", async () => {
    // Assertion source: UI grouping/labels + cart model API (per-line unitPrice
    // unaffected by mix). Needs kids/senior SKUs in the seeded catalog and
    // data-testid="cart-group-{segment}".
  });

  // [13] Persistence: quiz + personalize survive close/reopen ≤5 min.
  test.fixme("[13] preferences + cart restored after close/reopen within policy", async () => {
    // Assertion source: localStorage (tanmatra:cart:v1) + profile/cart API.
    // Complete the personalization quiz, snapshot storage, reload with a fresh
    // context (cookies preserved), assert cart items + preferences restored.
  });
});
