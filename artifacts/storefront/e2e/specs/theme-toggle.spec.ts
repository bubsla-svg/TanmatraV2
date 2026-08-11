import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * D-09 (TNM-CRO-01 owner ruling 2026-08-11): ThemeToggle was imported in
 * Header.tsx and rendered nowhere — mounted now, where ServiceabilityBar's
 * own width-budget comment already assumed it lived. §15: the toggle flips
 * the theme with no route remount, no state loss, and both themes' focus
 * rings stay visible.
 *
 * What "flips the theme" asserts is the PAINTED scheme (the documentElement's
 * computed color-scheme), not the raw data-theme attribute: on a Stitch route
 * the first paint is forced dark by `data-stitch` while data-theme still says
 * "light", so the first toggle tap stores an explicit "light" choice and
 * un-forces the canvas — the page visibly flips dark→light with data-theme
 * unchanged. Asserting the attribute alone rejected exactly the behaviour
 * the 2026-08-11 fix shipped ("toggle in nav bar is dead").
 */

/** The scheme the customer actually sees — data-stitch's !important rule and
 *  next-themes' inline style both land here. */
function paintedScheme(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
}

test("theme toggle flips the painted scheme and yields the Stitch canvas to the choice", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  await expect(toggle).toBeVisible();

  // "/" is a Stitch route: with no stored choice it must paint dark even for
  // a light-OS visitor, and the toggle must say so ("Switch to light theme").
  expect(await paintedScheme(page)).toBe("dark");
  await expect(toggle).toHaveAccessibleName(/switch to light theme/i);

  await toggle.click();
  await expect.poll(() => paintedScheme(page)).toBe("light");
  // The explicit choice un-forces the canvas — one mechanism in charge now.
  expect(
    await page.evaluate(() => document.documentElement.hasAttribute("data-stitch")),
  ).toBe(false);

  // Second tap: explicit dark, via data-theme like any non-Stitch surface.
  await toggle.click();
  await expect.poll(() => paintedScheme(page)).toBe("dark");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
    .toBe("dark");
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

test("an explicit light choice holds on Stitch routes across navigation and reload", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  // First tap on the dark-forced home canvas = choose light (the exact
  // customer report: the choice used to be silently overridden right here).
  await toggle.click();
  await expect.poll(() => paintedScheme(page)).toBe("light");

  // /menu is also a Stitch route — the stored choice must beat its canvas
  // on soft navigation…
  await page.goto("/menu");
  await expect.poll(() => paintedScheme(page)).toBe("light");

  // …and on a cold full load (the pre-paint guard script's half of the rule).
  await page.reload();
  await expect.poll(() => paintedScheme(page)).toBe("light");
  expect(
    await page.evaluate(() => document.documentElement.hasAttribute("data-stitch")),
  ).toBe(false);
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
