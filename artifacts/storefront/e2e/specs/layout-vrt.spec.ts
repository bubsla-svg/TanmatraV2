import { test, expect } from "@playwright/test";

test.describe("Visual Regression Tests: Global Chrome", () => {
  test("Global header appearance", async ({ page }) => {
    await page.goto("/");
    // Ensure fonts and images are loaded
    await page.waitForLoadState("networkidle");
    const header = page.locator("header").first();
    
    // Assert visual parity with baseline
    await expect(header).toHaveScreenshot("global-header.png", {
      maxDiffPixels: 100, // allow minor anti-aliasing diffs
    });
  });

  test("Global footer appearance", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    
    // Assert visual parity with baseline
    await expect(footer).toHaveScreenshot("global-footer.png", {
      maxDiffPixels: 150,
    });
  });

  // Specifically check the Marketplace to ensure it doesn't drift 
  // from the global layout
  test("Marketplace header matches global baseline", async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");
    const header = page.locator("header").first();
    
    await expect(header).toHaveScreenshot("global-header.png", {
      maxDiffPixels: 100,
    });
  });
});
