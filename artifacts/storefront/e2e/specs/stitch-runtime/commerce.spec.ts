import { test, expect } from "@playwright/test";
import { marker, evidenceShot } from "./support";
// Server-fetched data (RSC → API_BASE_URL) cannot be page.route-stubbed; these
// entries verify only against the full local stack (run with E2E_FULL_STACK=1).
const fullStack = process.env["E2E_FULL_STACK"] === "1" ? test : test.skip;
import { ORDERABLE_DISH } from "../../fixtures";
import { MenuPage } from "../../support/pages/MenuPage";
import { CartDrawer } from "../../support/pages/CartDrawer";

/**
 * Stitch-runtime evidence â Â§5 commerce screens.
 *
 * Every test follows the same contract: navigate the CANONICAL route (or open
 * the overlay via its real user trigger), assert role/name-first (heading or
 * primary action), then the diagnostic marker (data-screen-id + state), and
 * finally capture the evidence screenshot LAST so the shot shows the asserted
 * state. Runs live against the local-or-deployed server like the CUJ suite â
 * no network stubbing (fixtures.ts lesson #1: drive the real UI).
 *
 * Overlay entries (5.4, 5.6) verify close behaviour + parent-route
 * preservation mid-test, then REOPEN before the shot so the evidence captures
 * the open state the manifest names.
 */

test.describe("stitch-runtime: commerce (5.x)", () => {
  test("5.1 home clinical feed is wired", async ({ page }) => {
    await page.goto("/");
    // Primary order action: the hero's gold CTA into the menu. exact â the
    // page also renders "View menu" and a bare "Order" link.
    await expect(page.getByRole("link", { name: "Explore menu", exact: true })).toBeVisible();
    // The hero h1 binds DTR-personalised copy; assert the stable curated rail
    // heading instead of a cookie-dependent string.
    await expect(page.getByRole("heading", { name: "Curated for today" })).toBeVisible();
    await expect(marker(page, "5.1", "default")).toBeVisible();
    await evidenceShot(page, "5.1");
  });

  test("5.2 menu grid is wired", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto(); // asserts the "The menu" heading internally
    // Primary action "Add a dish to cart": at least one Add CTA on the grid.
    await expect(menu.addButtons.first()).toBeVisible();
    await expect(marker(page, "5.2", "default")).toBeVisible();
    await evidenceShot(page, "5.2");
  });

  test("5.4 dish quick view is wired", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    // Real trigger: the dish card link on the menu grid.
    await menu.cardLink().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(ORDERABLE_DISH.name)).toBeVisible();
    // Primary action ("Add to cart" in the manifest) renders as the exact
    // "Add" CTA â exact dodges "Add to group"/"Added â" collisions.
    await expect(dialog.getByRole("button", { name: "Add", exact: true })).toBeVisible();
    await expect(marker(page, "5.4", "dish-quick-view-open")).toBeVisible();
    // URL-driven island: open state lives at /menu?dish=<slug>.
    await expect(page).toHaveURL(new RegExp(`dish=${ORDERABLE_DISH.slug}`));
    // Close works (escape) and the parent route is preserved.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/menu$/);
    // Reopen so the evidence shot captures the open state.
    await menu.cardLink().click();
    await expect(marker(page, "5.4", "dish-quick-view-open")).toBeVisible();
    await evidenceShot(page, "5.4");
  });

  test("5.5 standalone dish PDP is wired", async ({ page }) => {
    // Slug obtained by clicking through from the listing (proves the trigger
    // chain): menu card -> quick view -> its canonical "Open full page" link.
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.cardLink().click();
    await page.getByRole("link", { name: "Open full page" }).click();
    await expect(page).toHaveURL(new RegExp(`/dish/${ORDERABLE_DISH.slug}$`));
    await expect(page.getByRole("heading", { name: ORDERABLE_DISH.name })).toBeVisible();
    // Guest purchase action must be present and live (cuj-01b contract).
    await expect(page.getByRole("button", { name: /^add to cart$/i })).toBeVisible();
    await expect(marker(page, "5.5", "default")).toBeVisible();
    await evidenceShot(page, "5.5");
  });

  test("5.6 cart drawer is wired", async ({ page }) => {
    const menu = new MenuPage(page);
    const cart = new CartDrawer(page);
    await menu.goto();
    // Real trigger chain: add an item, then the accessible "View cart" control.
    await menu.addToCart();
    await menu.openCart();
    await expect(cart.title).toBeVisible();
    await expect(cart.line(ORDERABLE_DISH.name)).toBeVisible();
    await expect(marker(page, "5.6", "cart-drawer-open")).toBeVisible();
    // Parent route is preserved while the overlay is open (not URL-driven).
    await expect(page).toHaveURL(/\/menu$/);
    // Primary action "Checkout" is flag-dual (mirrors cuj-01): live link when
    // built in, LOUD gated status otherwise â never a dead CTA.
    if (process.env["E2E_LIVE_CHECKOUT"] === "1") {
      await expect(cart.checkoutLink).toBeVisible();
    } else {
      await expect(cart.gatedStatus).toBeVisible();
    }
    // Close works (escape) and the parent route survives.
    await page.keyboard.press("Escape");
    await expect(cart.root).toBeHidden();
    await expect(page).toHaveURL(/\/menu$/);
    // Reopen so the evidence shot captures the open state.
    await menu.openCart();
    await expect(marker(page, "5.6", "cart-drawer-open")).toBeVisible();
    await evidenceShot(page, "5.6");
  });

  fullStack("5.7 marketplace listing is wired", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "Marketplace", exact: true })).toBeVisible();
    // Primary action "Add a product to cart" starts at a product card link.
    await expect(page.locator('a[href^="/marketplace/"]').first()).toBeVisible();
    await expect(marker(page, "5.7", "default")).toBeVisible();
    await evidenceShot(page, "5.7");
  });

  fullStack("5.8 marketplace product PDP is wired", async ({ page }) => {
    // Slug obtained by clicking the first product card on the listing â
    // proves the manifest's link trigger from marketplace-default.
    await page.goto("/marketplace");
    const firstCard = page.locator('a[href^="/marketplace/"]').first();
    await expect(firstCard).toBeVisible();
    const productName = ((await firstCard.getByRole("heading").textContent()) ?? "").trim();
    expect(productName.length).toBeGreaterThan(0);
    await firstCard.click();
    await expect(page).toHaveURL(/\/marketplace\/[^/?#]+$/);
    // The PDP h1 is the exact product name the card advertised.
    await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to Order" })).toBeVisible();
    // DEF-RECON-MARKETPLACE-001: payForMarketplace() had zero callers — the
    // PDP's own money-path CTA, alongside the cart-only "Add to Order".
    await expect(page.getByRole("button", { name: "Buy now" })).toBeVisible();
    await expect(marker(page, "5.8", "default")).toBeVisible();
    await evidenceShot(page, "5.8");
  });

  test("5.9 meal deals is wired", async ({ page }) => {
    await page.goto("/meal-deals");
    await expect(page.getByRole("heading", { name: "Meal Bundles", exact: true })).toBeVisible();
    // Primary action ("Add combo to cart") renders as the bundle CTA.
    await expect(page.getByRole("button", { name: "Select Bundle" }).first()).toBeVisible();
    await expect(marker(page, "5.9", "default")).toBeVisible();
    await evidenceShot(page, "5.9");
  });

  test("5.10 meal recommendations is wired", async ({ page }) => {
    await page.goto("/meal-recommendations");
    await expect(page.getByRole("heading", { name: "For You", exact: true })).toBeVisible();
    // Primary action "Add recommended dish": DishCard's exact "Add" CTA.
    await expect(page.getByRole("button", { name: "Add", exact: true }).first()).toBeVisible();
    await expect(marker(page, "5.10", "default")).toBeVisible();
    await evidenceShot(page, "5.10");
  });

  test("5.11 meal reheating & macro guide is wired", async ({ page }) => {
    // Direct navigation with the pinned fixture slug (mirrors cuj-01b's
    // parameterised-route approach). The manifest trigger â a "Meal guide
    // link" from order-history â needs an authenticated account with orders,
    // which this guest suite does not establish.
    await page.goto(`/meal-guides/${ORDERABLE_DISH.slug}`);
    await expect(page.getByRole("heading", { name: "Meal Guide", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: ORDERABLE_DISH.name })).toBeVisible();
    // The page's actionable way onward to the orderable dish surface.
    await expect(page.getByRole("link", { name: "View Dish", exact: true })).toBeVisible();
    await expect(marker(page, "5.11", "default")).toBeVisible();
    await evidenceShot(page, "5.11");
  });

  fullStack("5.12 recipe library is wired", async ({ page }) => {
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Clinical Recipes", exact: true })).toBeVisible();
    // Primary action "Open recipe": at least one recipe card link.
    await expect(page.locator('a[href^="/recipes/"]').first()).toBeVisible();
    await expect(marker(page, "5.12", "default")).toBeVisible();
    await evidenceShot(page, "5.12");
  });
});
