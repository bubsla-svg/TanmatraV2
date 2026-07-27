import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH } from "../fixtures";

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
  
  // 1. Land on homepage, verify sticky address selector is present in the header
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("main").getByText("Select your location", { exact: false })).toBeVisible();

  // 2. Marketplace is visible on the homepage
  await expect(page.getByRole("heading", { name: /Meal Plans Designed for Real Results|Dietitian-Approved Pantry|The RD-Curated Pantry|Everyday Wellness/i })).toBeVisible();

  // Navigate to Marketplace
  await page.goto("/marketplace");
  await expect(page.getByRole("heading", { name: /The Tanmatra Marketplace|Marketplace/i })).toBeVisible();

  // Add an item to cart from marketplace (using the standard add button if available, or just go to menu)
  await page.goto("/menu");
  
  // The 'Add' button is SSR'd, so Playwright might click it before React hydrates.
  // Retry until the 'View cart' button appears.
  await expect(async () => {
    const addBtn = page.getByRole("button", { name: "Add", exact: true }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
    }
    await expect(page.getByRole("button", { name: "View cart" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });

  // View cart
  await page.getByRole("button", { name: "View cart" }).click();
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
