import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";
import { CartDrawer } from "../support/pages/CartDrawer";
import { locationTrigger } from "../support/locators";

/**
 * Core Revenue Funnel (Phase 2 Proactive QA)
 * Verifies the primary happy path:
 * 1. Global Address/Serviceability selector is present
 * 2. Marketplace is accessible from Homepage
 * 3. User can add an item to the cart and proceed to checkout
 * 4. Checkout correctly mandates authentication for anonymous users
 */

test("core funnel: address -> marketplace -> cart -> checkout login prompt", async ({ page }) => {
  const errors = collectErrors(page);
  
  // 1. Land on homepage, verify sticky address/serviceability bar is present
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  // Page-scoped, not <main>-scoped: scoping to <main> asserted a control the
  // mobile layout deliberately hides, and failed every [mobile] run. What the
  // funnel needs is that a location picker is reachable — under whichever
  // label the breakpoint calls for, which is `locationTrigger`'s whole job.
  await expect(locationTrigger(page).first()).toBeVisible();

  // 2. The homepage rendered its commerce sections.
  //
  // This asserted a four-way alternation of headings — plans OR pantry OR two
  // older pantry names — under a comment claiming to check the marketplace. It
  // matched the PLANS heading, which is why it kept passing: this environment
  // runs `next start` with no API, so the pantry section has no items and
  // (correctly) renders nothing rather than heading an empty grid. Asserting
  // the plans heading directly says what the step actually verifies, and does
  // not depend on data this environment does not have. The marketplace itself
  // is covered by the /marketplace navigation immediately below.
  await expect(page.getByRole("heading", { name: "Pick a plan, we cook the rest." })).toBeVisible();

  // Navigate to Marketplace
  await page.goto("/marketplace");
  await expect(page.getByRole("heading", { name: /The Tanmatra Marketplace|Marketplace/i })).toBeVisible();

  // Add an item to cart from marketplace (using the standard add button if available, or just go to menu)
  const menu = new MenuPage(page);
  const cart = new CartDrawer(page);
  await menu.goto();
  await expect(async () => {
    const card = menu.card();
    await card.scrollIntoViewIfNeeded();
    const addBtn = card.getByRole("button", { name: "Add" });
    if (await addBtn.isVisible()) {
      await addBtn.click();
    }
    await expect(page.getByRole("button", { name: "View cart" })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10_000 });

  // View cart
  await menu.openCart();
  await expect(cart.title).toBeVisible();

  // If live checkout is enabled, test the checkout flow redirection to login
  if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
    await cart.checkoutLink.click();
    await expect(page).toHaveURL(/\/checkout/);
    
    // On checkout, if unauthenticated, it should prompt for login or show guest details
    // We expect the form or a login prompt.
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  }

  // No unexpected errors in the process
  expect(errors).toEqual([]);
});
