import { expect, type Locator, type Page } from "@playwright/test";
import { ORDERABLE_DISH } from "../../fixtures";

/**
 * Page object for `/menu` — the à-la-carte grid and its per-card controls.
 *
 * Exists because the same three locators were retyped inline across
 * `cuj-01-menu-cart.spec.ts` (×3) and `core-funnel.spec.ts` (×1):
 * `page.locator("article", { hasText: ORDERABLE_DISH.name }).first()`, the
 * `"Add"` button inside it, and `a[href^="/menu?dish="]` for the card links.
 * Four copies of a selector is four places to edit when the markup moves, and
 * three of them will be missed.
 *
 * Selectors here are role- and href-based on purpose: `getByRole` reads the
 * accessibility tree, so a card that is present in the DOM but hidden (the
 * `hidden` attribute MenuGrid puts on diet-filtered rows) is correctly invisible
 * to it. A raw CSS locator would find those and assert against a row no user
 * can see.
 */
export class MenuPage {
  private readonly page: Page;

  // NOT a parameter property (`constructor(private readonly page: Page)`):
  // Node's strip-only type stripping — which Playwright uses to load these
  // files — rejects those outright with "TypeScript parameter property is
  // not supported in strip-only mode", and the whole suite fails to load.
  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/menu");
    await expect(this.heading).toBeVisible();
  }

  /** The route's H1. It is `sr-only` since the 2026-08-16 density pass — the
   *  visible title came out, the heading did not — so this is a
   *  role/accessible-name locator by necessity, not by style. Playwright
   *  still counts it visible (sr-only is a 1×1 clipped box, not
   *  `visibility: hidden`), which is what keeps `goto()`'s ready-check
   *  working while asserting the heading outline never silently vanished. */
  get heading(): Locator {
    return this.page.getByRole("heading", { name: "The menu" });
  }

  /** Every dish card link on the grid. The count assertion the specs make
   *  (`> 35`) is a deliberate floor, not an exact number — curation changes
   *  the catalog size and should not break the suite. */
  get dishCardLinks(): Locator {
    return this.page.locator('a[href^="/menu?dish="]');
  }

  /** Same links, but respecting the `hidden` attribute a diet/sheet filter
   *  puts on a row it narrows out — `dishCardLinks` is deliberately raw CSS
   *  (see the class doc) so a filter test needs the visible-only variant
   *  instead of asserting against a card no user can see or click. */
  get visibleDishCardLinks(): Locator {
    return this.page.locator('a[href^="/menu?dish="]:visible');
  }

  /** Every "Add" CTA. Card-count parity with `dishCardLinks` is the
   *  à-la-carte-only invariant: a card with no Add is a browse-only dead end. */
  get addButtons(): Locator {
    return this.page.getByRole("button", { name: "Add", exact: true });
  }

  /** The card for a named dish. Defaults to the curated orderable hero so the
   *  specs stop hardcoding it. */
  card(dishName: string = ORDERABLE_DISH.name): Locator {
    return this.page.locator("article", { hasText: dishName }).first();
  }

  /** Deep-link anchor for one dish — opens the PDP bottom sheet. */
  cardLink(slug: string = ORDERABLE_DISH.slug): Locator {
    return this.page.locator(`a[href="/menu?dish=${slug}"]`).first();
  }

  async addToCart(dishName: string = ORDERABLE_DISH.name): Promise<void> {
    await this.card(dishName).getByRole("button", { name: "Add" }).click();
  }

  /** The in-place stepper that replaces Add after a one-tap add (§4.1). */
  quantityStepper(dishName: string = ORDERABLE_DISH.name): Locator {
    return this.card(dishName).getByRole("group", { name: `${dishName} quantity` });
  }

  async increaseQuantity(dishName: string = ORDERABLE_DISH.name): Promise<void> {
    await this.card(dishName).getByRole("button", { name: "Increase quantity" }).click();
  }

  /** Mini-bar cart summary ("1 item" / "2 items"). */
  itemCount(count: number): Locator {
    return this.page.getByText(count === 1 ? "1 item" : `${count} items`);
  }

  async openCart(): Promise<void> {
    await this.page.getByRole("button", { name: "View cart" }).click();
  }

  /** A diet chip button ("All" / "Veg" / "Non-veg"). Anchored regex, not a
   *  plain string: an ACTIVE chip's accessible name gains a "✓ " prefix, and
   *  default substring matching would otherwise make "Veg" match "Non-veg"
   *  too (it's a real substring of it). */
  dietChip(label: "All" | "Veg" | "Non-veg"): Locator {
    const pattern = new RegExp(`^(?:✓\\s*)?${label}$`);
    return this.page
      .getByRole("group", { name: "Filter dishes by diet" })
      .getByRole("button", { name: pattern });
  }

  get filterTrigger(): Locator {
    return this.page.getByTestId("menu-filter-trigger");
  }

  get activeFiltersText(): Locator {
    return this.page.getByTestId("menu-active-filters");
  }

  /**
   * Open the 5.3 filter sheet, toggle one chip in one group, and apply.
   *
   * Lives here because narrowing the grid is now a THREE-step interaction —
   * the inline search box that used to do it in one `fill()` was removed
   * (2026-08-16). Two specs need it already, and inline copies of a
   * multi-step sheet drive are exactly the duplication this page object was
   * created to stop. `group` is the sheet's own section label; `option` is
   * the chip label, matched with the same ✓-tolerant anchored regex the diet
   * chips need, since an already-selected chip gains the prefix. The label is
   * escaped before it goes into that regex — "30g+ protein" is a real option
   * and a bare `+` would silently match the wrong button.
   */
  async applySheetFilter(group: string, option: string): Promise<void> {
    const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await this.filterTrigger.click();
    const sheet = this.page.getByTestId("menu-filter-sheet");
    await expect(sheet).toBeVisible();
    // T-14: the sheet's groups are accordions and only Goal opens by default.
    // A chip inside a collapsed group is not clickable, so open the group's
    // <details> first — via its <summary>, the way a thumb would. The section
    // is found by its SUMMARY text, not by the inner role=group: a closed
    // <details> hides its content from the accessibility tree, so a role
    // query would never match a collapsed group and the open check would
    // wait on nothing until the test timed out.
    const section = sheet
      .locator("details")
      .filter({ has: this.page.locator("summary", { hasText: group }) });
    await expect(section).toHaveCount(1);
    if ((await section.getAttribute("open")) === null) {
      await section.locator("summary").click();
    }
    await section
      .getByRole("group", { name: group })
      .getByRole("button", { name: new RegExp(`^(?:✓\\s*)?${escaped}$`) })
      .click();
    await this.page.getByTestId("menu-filter-apply").click();
    await expect(sheet).toBeHidden();
  }
}
