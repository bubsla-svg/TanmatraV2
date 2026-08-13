import { test, expect } from "@playwright/test";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * N2.3 (native-feel plan, Tier N2): committed diet-chip + search state used
 * to live in useState, so it reset on the unmount/remount back-navigation
 * causes. lib/menuUrlState.ts's round-trip (and its merge-preserves-`dish`
 * behavior) is unit-tested; this is the integration leg — a REAL back
 * navigation, via the dish drawer's own push (`?dish=slug`, a same-route
 * navigation with its own hardcoded query string that would otherwise drop
 * diet/q the instant it opens — see the sync effect's comment in
 * PersonalizedMenu.tsx), not `Escape` (a different, explicit-close code
 * path already covered by cuj-01-menu-cart.spec.ts).
 */

test("diet chip and search survive opening a dish and navigating back", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();

  await menu.dietChip("Veg").click();
  await menu.searchInput.fill("veg");

  // The URL sync is debounced (400ms) — wait for the address bar itself
  // rather than a fixed sleep, so this isn't a flaky timing guess.
  await expect(page).toHaveURL(/diet=veg/);
  await expect(page).toHaveURL(/q=veg/);

  const visibleCount = await menu.visibleDishCardLinks.count();
  expect(visibleCount).toBeGreaterThan(0);

  // Opening the drawer pushes ?dish=slug — a real history entry, and (before
  // the merge fix) one that silently dropped diet/q from the URL the moment
  // it was pushed, well before any back navigation.
  await menu.visibleDishCardLinks.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/dish=/);
  // The effect's own re-assertion is also debounced — give it the same
  // window before asserting diet/q survived the drawer opening.
  await expect(page).toHaveURL(/diet=veg/);
  await expect(page).toHaveURL(/q=veg/);

  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(menu.heading).toBeVisible();

  // The chip and search box reflect the restored URL, not a reset default.
  await expect(page).toHaveURL(/diet=veg/);
  await expect(page).toHaveURL(/q=veg/);
  await expect(menu.dietChip("Veg")).toHaveAttribute("aria-pressed", "true");
  await expect(menu.searchInput).toHaveValue("veg");
});

test("clearing back to defaults drops the query params entirely", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();

  await menu.searchInput.fill("veg");
  await expect(page).toHaveURL(/q=veg/);

  await menu.searchInput.fill("");
  await expect(page).not.toHaveURL(/q=/);
  await expect(page).toHaveURL(/\/menu$/);
});
