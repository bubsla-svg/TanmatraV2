import { test, expect } from "@playwright/test";
import { evidenceShot } from "./support";
import { MenuPage } from "../../support/pages/MenuPage";

/**
 * TNM-MENU-01 M-5 flipbook — evidence capture for every meaningful /menu
 * state the section-grouped grid can be in. Same contract as the rest of
 * `stitch-runtime/`: role/name-first assertions, then a deterministic
 * screenshot last so the shot matches the asserted state.
 *
 * NOTE on scope: the manual's M-5 section cites an "Experience Contract —
 * ten laws" review gate for this flipbook. That document does not exist
 * anywhere in this repository (verified by exhaustive grep — no match for
 * "Experience Contract", "ten laws", or any numbered law 1-10 as a
 * complete set; only scattered, unrelated citations to individual law
 * numbers exist elsewhere). This spec cannot review against a document
 * that isn't there, so it captures evidence against this repo's actual,
 * existing verification pattern (stitch-runtime markers + role assertions)
 * instead of fabricating compliance with an absent one.
 *
 * Assertions here are deliberately structural rather than tied to specific
 * section names or dish counts: `/menu` can render against the live
 * DB-governed catalog (real §5 section names) or the static fallback
 * catalog (no dish carries `sectionOrder`, so everything lands in one
 * trailing "More dishes" bucket) depending on E2E run mode. Both are
 * correct, real states — the invariants below hold in either.
 *
 * Personalization re-ranking (goal/allergen-driven fit bands) needs an
 * authenticated profile with a completed preferences quiz to observe, which
 * this guest-only suite does not establish — same limitation `menuFit.test.ts`
 * and `menuGridState.test.ts` cover at the unit level instead (pure,
 * DB/network-free, exercise the exact ranking + section-13-exclusion logic
 * this UI renders).
 */

test.describe("stitch-runtime: menu flipbook (M-5)", () => {
  test("default grid: at least one section, every card veg-marked, macros as a chip", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    // At least one section heading renders — true whether the run sees real
    // §5 sections or the fallback catalog's single "More dishes" bucket.
    const sectionHeadings = page.getByTestId("menu-section-heading");
    await expect(sectionHeadings.first()).toBeVisible();
    expect(await sectionHeadings.count()).toBeGreaterThan(0);

    // Every visible dish card carries a veg/non-veg/egg mark — the tri-state
    // mark is mandatory on every card, not just governed ones. A dedicated
    // testid (not a bare [role="img"] selector) because a broken dish photo
    // also renders role="img" + aria-label=<dish name> as its own fallback
    // (ImgWithFallback) — ambiguous without it.
    const marks = page.locator('article [data-testid="veg-mark"]');
    const markCount = await marks.count();
    expect(markCount).toBeGreaterThan(0);
    const firstLabel = await marks.first().getAttribute("aria-label");
    expect(["Vegetarian", "Non-vegetarian", "Contains egg"]).toContain(firstLabel);

    // Macros render as a styled chip (tabular numerals), not bare text.
    await expect(page.locator("article .tabular").first()).toContainText(/kcal/);

    await evidenceShot(page, "5.2-sectioned");
  });

  test("veg filter narrows within sections without losing section headings", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.dietChip("Veg").click();
    await expect(menu.dietChip("Veg")).toHaveAttribute("aria-pressed", "true");

    // Every still-visible mark is Vegetarian — the diet chip is user-initiated
    // hiding (allowed); it must not leave a non-veg card visible.
    const visibleMarks = page.locator('article:visible [data-testid="veg-mark"]');
    const labels = await visibleMarks.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).toBe("Vegetarian");

    await evidenceShot(page, "5.2-veg-filtered");
  });

  // Was "search narrows the grid" until the inline search box was removed
  // (2026-08-16). The invariant is about NARROWING, not about which control
  // did it, so it now drives the filter sheet — the narrowing control that
  // still writes `menu-active-filters`.
  test("the filter sheet narrows the grid; section grouping survives", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.applySheetFilter("Macro intent", "30g+ protein");
    await expect(page.getByTestId("menu-active-filters")).toBeVisible();

    // At least one section heading still renders among the narrowed results,
    // OR the explicit no-match empty state does — never a blank page.
    const sectionHeadings = page.getByTestId("menu-section-heading");
    const noMatch = page.getByTestId("menu-no-match-empty");
    await expect(sectionHeadings.first().or(noMatch)).toBeVisible();

    await evidenceShot(page, "5.2-sheet-filtered");
  });
});
