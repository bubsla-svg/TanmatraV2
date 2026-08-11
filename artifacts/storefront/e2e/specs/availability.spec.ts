import { test, expect } from "@playwright/test";
import { ORDERABLE_DISH } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * D-19 (CRITICAL) — availability propagation. 76/145 live dishes were
 * `isAvailable:false` yet fully sellable on `/menu` and `/dish/[slug]`; the
 * customer only learned the truth at checkout's resolution step. This spec
 * proves the paused state is visible and non-addable at both surfaces, and
 * that an available dish is untouched by the change.
 *
 * DEPLOYED-ONLY, same reason as CUJ-09's live-menu assertions (see that
 * spec): a paused dish is real menu data, not something `page.route` can
 * fabricate — the menu fetch is an RSC server fetch (`lib/catalog.ts`,
 * `API_BASE_URL`), which runs in the Next.js server process, never in the
 * browser context Playwright controls. The PR-gate build has no live API
 * behind it and falls back to the static catalog, where every dish is
 * `isAvailable:true` (menu-catalog's curated set has none paused) — so there
 * is no fixture-free way to exercise the paused branch before deploy. Not
 * covered here, honestly: the PR-gate build never sees this path; only the
 * deployed run (`E2E_LIVE_CHECKOUT=1`) does. cartStore's own refusal
 * (`addLine(..., { isAvailable: false })`) is unit-tested DB-free in
 * `lib/cartStore.test.ts` and runs on every PR regardless.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

interface LiveDish {
  id: number;
  slug: string;
  name: string;
  isAvailable?: boolean;
}

deployedLive("a paused dish is not addable from the menu grid or its PDP", async ({ page }) => {
  const menuRes = await page.request.get("/api/menu/public");
  expect(menuRes.ok()).toBeTruthy();
  const { dishes } = (await menuRes.json()) as { dishes: LiveDish[] };
  const paused = dishes.find((d) => d.isAvailable === false);
  expect(paused, "live menu has at least one paused (isAvailable:false) dish").toBeTruthy();

  // Menu grid: the card renders, but the disabled "Back soon" state stands
  // in for Add — image and macros are untouched (Law 8), so the card is
  // findable by name exactly as any other card.
  const menu = new MenuPage(page);
  await menu.goto();
  const card = menu.card(paused!.name);
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: /^add$/i })).toHaveCount(0);
  const backSoonOnCard = card.getByRole("button", { name: /back soon/i });
  await expect(backSoonOnCard).toBeVisible();
  await expect(backSoonOnCard).toBeDisabled();

  // PDP: the sticky ledger CTA is the same disabled state, never a live Add.
  await page.goto(`/dish/${paused!.slug}`);
  await expect(page.getByRole("heading", { name: paused!.name })).toBeVisible();
  await expect(page.getByRole("button", { name: /^add to cart$/i })).toHaveCount(0);
  const backSoonOnPdp = page.getByRole("button", { name: /back soon/i });
  await expect(backSoonOnPdp).toBeVisible();
  await expect(backSoonOnPdp).toBeDisabled();
});

deployedLive("an available dish still adds normally from both surfaces", async ({ page }) => {
  const menuRes = await page.request.get("/api/menu/public");
  const { dishes } = (await menuRes.json()) as { dishes: LiveDish[] };
  const available = dishes.find((d) => d.isAvailable !== false) ?? { slug: ORDERABLE_DISH.slug, name: ORDERABLE_DISH.name };

  const menu = new MenuPage(page);
  await menu.goto();
  const card = menu.card(available.name);
  await expect(card.getByRole("button", { name: /^add$/i })).toBeEnabled();
  await card.getByRole("button", { name: /^add$/i }).click();
  await expect(card.getByRole("group", { name: `${available.name} quantity` })).toBeVisible();

  await page.goto(`/dish/${available.slug}`);
  await expect(page.getByRole("button", { name: /^add to cart$/i })).toBeEnabled();
});
