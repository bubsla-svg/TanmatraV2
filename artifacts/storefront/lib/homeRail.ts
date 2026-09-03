/**
 * "On the menu today" — which five dishes lead the homepage (T-23).
 *
 * The rail used to be `dishes.slice(0, 5)` — alphabetical, so a new visitor's
 * first card was a ₹50 smoothie wearing "Macros being verified". The first
 * thing a clinical-nutrition brand shows should be a main whose numbers it
 * can stand behind. Ranking here is a pure data question, pinned by test.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { macroTrust } from "./dishTrust";

/** Mains first; beverages never. Order is what the rail leads with. */
const CATEGORY_RANK: Record<string, number> = {
  mains: 0,
  bowls: 1,
  wraps: 2,
  pasta: 3,
  salads: 4,
  breakfast: 5,
  soups: 6,
  snacks: 7,
};

function rank(d: DishData): number {
  return CATEGORY_RANK[d.category] ?? 8;
}

/**
 * Pick the rail: orderable, non-beverage dishes with trusted macros, mains
 * first, higher protein first within a category, priced at least
 * `minPricePaise` (the plan per-meal price — so the first card is not a snack
 * undercutting the plan it sits above). If the price floor leaves the rail
 * short, it is relaxed rather than leaving empty cards.
 */
export function pickHomeRail(
  dishes: readonly DishData[],
  sharedMacroKeys: ReadonlySet<string>,
  limit: number,
  minPricePaise = 0,
): DishData[] {
  const eligible = dishes.filter(
    (d) =>
      isAlaCarteEnabled(d) &&
      d.category !== "beverages" &&
      macroTrust(d, sharedMacroKeys) !== "unverified",
  );
  const order = (a: DishData, b: DishData) =>
    rank(a) - rank(b) || b.macros.protein - a.macros.protein || a.name.localeCompare(b.name);
  const priced = eligible.filter((d) => d.price >= minPricePaise).sort(order);
  if (priced.length >= limit) return priced.slice(0, limit);
  const seen = new Set(priced.map((d) => d.id));
  const rest = eligible.filter((d) => !seen.has(d.id)).sort(order);
  return [...priced, ...rest].slice(0, limit);
}
