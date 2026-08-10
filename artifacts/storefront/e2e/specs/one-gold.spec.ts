import { test, expect } from "@playwright/test";
import { ORDERABLE_DISH } from "../fixtures";
import { waitForHydration } from "../support/ghost-ui.probes";
import { goldElementsInViewport } from "../support/goldProbe";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * D-08 (MAJOR, systemic) — "gold is the purchase signal; the eye has nowhere
 * to land" when several elements compete for it. §4.2 allows exactly one
 * gold interactive element per initial viewport. Runs against the PR-gate
 * build: every surface below is reachable without a live API (the static
 * fallback catalog serves /menu and /dish/[slug]; checkout and plan render
 * their real forms off client-side cart/plan-catalog state).
 *
 * "Port funnel2.mjs's goldInViewport()" (the runbook's cited reference) — no
 * such file exists in this repository (checked: no audit-evidence/ directory,
 * no funnel2.mjs anywhere in the tree). Re-verifying the anchor (Bible Law
 * 9.5) found it was never committed here — an artifact of the separate audit
 * process, not this codebase. `support/goldProbe.ts` is a from-scratch
 * equivalent built to the runbook's own description (computed-background
 * comparison against a live `var(--gold)` probe element), not a port.
 */

async function assertAtMostOneGold(page: import("@playwright/test").Page, surface: string): Promise<void> {
  await waitForHydration(page);
  const found = await goldElementsInViewport(page);
  expect(
    found.length,
    `${surface}: expected ≤1 gold interactive element, found ${found.length} — ${JSON.stringify(found)}`,
  ).toBeLessThanOrEqual(1);
}

test("menu grid: at most one gold element in the initial viewport", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await assertAtMostOneGold(page, "/menu");
});

test("dish PDP: at most one gold element in the initial viewport", async ({ page }) => {
  await page.goto(`/dish/${ORDERABLE_DISH.slug}`);
  await expect(page.getByRole("heading", { name: ORDERABLE_DISH.name })).toBeVisible();
  await assertAtMostOneGold(page, `/dish/${ORDERABLE_DISH.slug}`);
});

test("cart drawer open: at most one gold element in the initial viewport", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.addToCart();
  await menu.openCart();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertAtMostOneGold(page, "menu drawer-open");
});

test("à-la-carte checkout: at most one gold element in the initial viewport", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.addToCart();
  await page.goto("/checkout?mode=alacarte"); // direct nav — no live-checkout flag needed to reach this page
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await assertAtMostOneGold(page, "/checkout?mode=alacarte");
});

test("plan config: at most one gold element in the initial viewport", async ({ page }) => {
  await page.goto("/plan/desk_fuel");
  await assertAtMostOneGold(page, "/plan/desk_fuel");
});
