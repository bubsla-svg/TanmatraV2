import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * D-09 (TNM-CRO-01 owner ruling 2026-08-11): ThemeToggle was imported in
 * Header.tsx and rendered nowhere — mounted now, where ServiceabilityBar's
 * own width-budget comment already assumed it lived. §15: the toggle flips
 * the `data-theme` attribute on <html> with no route remount, no state loss,
 * and both themes' focus rings stay visible.
 */

test("theme toggle exists on the header and flips <html data-theme>", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  await expect(toggle).toBeVisible();

  const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
    .not.toBe(before);
  expect(errors).toEqual([]);
});

test("toggling theme does not remount the route — cart state survives", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.addToCart();

  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  await toggle.click();

  // Cart survived: the stepper (not a fresh "Add") is still in place.
  await expect(menu.quantityStepper()).toBeVisible();
});

test("theme choice persists across navigation and reload", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  await toggle.click();
  const afterToggle = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));

  await page.goto("/menu");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
    .toBe(afterToggle);

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
    .toBe(afterToggle);
});

test("focus ring is visible on the toggle in both themes", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });

  await toggle.focus();
  const lightOutline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(lightOutline).not.toBe("none");

  await toggle.click();
  await page.waitForTimeout(100);
  await toggle.focus();
  const darkOutline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(darkOutline).not.toBe("none");
});
