import { test, expect } from "@playwright/test";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * N2.3 (native-feel plan, Tier N2): committed diet-chip + sheet-filter state
 * used to live in useState, so it reset on the unmount/remount back
 * navigation causes. lib/menuUrlState.ts's round-trip (and its
 * merge-preserves-`dish` behavior) is unit-tested; this is the integration
 * leg — a REAL back navigation, via the dish drawer's own push (`?dish=slug`,
 * a same-route navigation with its own hardcoded query string that would
 * otherwise drop diet/filters the instant it opens — see the sync effect's
 * comment in PersonalizedMenu.tsx), not `Escape` (a different,
 * explicit-close code path already covered by cuj-01-menu-cart.spec.ts).
 *
 * These tests drove the inline search box until 2026-08-16, when it was
 * removed from /menu. The behaviour under test never was search-specific —
 * it is "committed narrowing survives a same-route navigation" — so they now
 * drive the filter sheet, which is the narrowing control that remains.
 */

test("diet chip and sheet filter survive opening a dish and navigating back", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();

  await menu.dietChip("Veg").click();
  await menu.applySheetFilter("What you eat", "Vegetarian");

  // The URL sync is debounced (400ms) — wait for the address bar itself
  // rather than a fixed sleep, so this isn't a flaky timing guess.
  await expect(page).toHaveURL(/diet=veg/);
  await expect(page).toHaveURL(/dietary=vegetarian/);

  const visibleCount = await menu.visibleDishCardLinks.count();
  expect(visibleCount).toBeGreaterThan(0);

  // Opening the drawer pushes ?dish=slug — a real history entry, and (before
  // the merge fix) one that silently dropped diet/filters from the URL the
  // moment it was pushed, well before any back navigation.
  await menu.visibleDishCardLinks.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/dish=/);
  // The effect's own re-assertion is also debounced — give it the same
  // window before asserting diet/filters survived the drawer opening.
  await expect(page).toHaveURL(/diet=veg/);
  await expect(page).toHaveURL(/dietary=vegetarian/);

  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(menu.heading).toBeVisible();

  // The chip and the applied filter reflect the restored URL, not a reset
  // default — the summary line is the user-visible proof of the latter.
  await expect(page).toHaveURL(/diet=veg/);
  await expect(page).toHaveURL(/dietary=vegetarian/);
  await expect(menu.dietChip("Veg")).toHaveAttribute("aria-pressed", "true");
  await expect(menu.activeFiltersText).toContainText("Vegetarian");
});

test("clearing back to defaults drops the query params entirely", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();

  await menu.dietChip("Veg").click();
  await expect(page).toHaveURL(/diet=veg/);

  await menu.dietChip("All").click();
  await expect(page).not.toHaveURL(/diet=/);
  await expect(page).toHaveURL(/\/menu$/);
});

test("a legacy ?q= link is evicted, not left advertising a search", async ({ page }) => {
  // `q` backed the removed search box. It is still a MANAGED param precisely
  // so a bookmark or shared link carrying it gets cleaned on arrival rather
  // than sitting in the address bar implying a narrowing that never happens.
  await page.goto("/menu?q=bowl");
  const menu = new MenuPage(page);
  await expect(menu.heading).toBeVisible();

  await expect(page).not.toHaveURL(/q=/);
  // The grid is the full list, not something narrowed by the stale term.
  expect(await menu.visibleDishCardLinks.count()).toBeGreaterThan(35);
});
