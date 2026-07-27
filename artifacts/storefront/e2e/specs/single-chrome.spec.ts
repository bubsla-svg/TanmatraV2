import { test, expect } from "@playwright/test";

/**
 * Exactly-one-chrome guard. The M3 homepage brings its own nav (§0), bottom
 * bar (§11) and footer (§12); the root layout wraps every route in the global
 * Header/Footer/BottomNav. Before ChromeGate, `/` rendered two logos, two
 * <header>s and two <footer>s stacked — shipped in #433 because nothing
 * asserted a count. This does.
 */
test.describe("chrome is rendered exactly once per route", () => {
  test("homepage: one header, one footer, no global-nav duplicates", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    // Global header/bottom-nav provides the app links cluster on homepage
    await expect(page.getByRole("link", { name: "Account" })).toHaveCount(1);
  });

  test("menu keeps the global chrome (gate must not over-suppress)", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Account" })).toHaveCount(1);
  });
});
