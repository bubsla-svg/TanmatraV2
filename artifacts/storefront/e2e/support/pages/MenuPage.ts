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

  /** The dish-name search box (N2.3 URL-as-state). */
  get searchInput(): Locator {
    return this.page.getByRole("searchbox", { name: "Search dishes" });
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
}
