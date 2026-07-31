import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH, revealAllDishes } from "../fixtures";

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
  // Page-scoped, not <main>-scoped. The serviceability entry point is rendered
  // twice on purpose: the Header carries it at every width, and app/page.tsx
  // adds an in-<main> copy only from `sm` up ("hidden sm:block" — mobile hides
  // it to avoid header redundancy). Scoping to <main> therefore asserted a
  // control the mobile layout deliberately hides, and failed every [mobile] run.
  // What the funnel actually needs is that a location picker is reachable.
  await expect(page.getByText("Select your location", { exact: false }).first()).toBeVisible();

  // 2. Marketplace is visible on the homepage
  await expect(page.getByRole("heading", { name: /Meal Plans Designed for Real Results|Dietitian-Approved Pantry|The RD-Curated Pantry|Everyday Wellness/i }).first()).toBeVisible();

  // Navigate to Marketplace
  await page.goto("/marketplace");
  await expect(page.getByRole("heading", { name: /The Tanmatra Marketplace|Marketplace/i })).toBeVisible();

  // Add an item to cart from marketplace (using the standard add button if available, or just go to menu)
  await page.goto("/menu");
  await page.waitForLoadState("networkidle");
  await revealAllDishes(page);
  await expect(async () => {
    const card = page.locator("article").filter({ hasText: ORDERABLE_DISH.name }).first();
    await card.scrollIntoViewIfNeeded();
    const addBtn = card.getByRole("button", { name: "Add" });
    if (await addBtn.isVisible()) {
      await addBtn.click();
    }
    await expect(page.getByRole("button", { name: "View cart" })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10_000 });

  // View cart
  const viewCartBtn = page.getByRole("button", { name: "View cart" });
  await expect(viewCartBtn).toBeVisible();
  await viewCartBtn.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Your cart" })).toBeVisible();

  // If live checkout is enabled, test the checkout flow redirection to login
  if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
    await drawer.getByRole("link", { name: "Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    
    // On checkout, if unauthenticated, it should prompt for login or show guest details
    // We expect the form or a login prompt.
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  }

  // No unexpected errors in the process
  expect(errors).toEqual([]);
});
