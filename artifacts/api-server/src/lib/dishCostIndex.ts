/**
 * Resolving an order line to what the food in it actually cost us.
 *
 * Recipe costs are keyed by **slug** (`quinoa-upma`). Order lines only carry a
 * display **name** (`Quinoa Upma`). Every consumer of recipe costs therefore
 * has to bridge those two key spaces, and doing it ad hoc is how the weekly
 * margin ended up wrong: `wbr.ts` looked a lowercased name up in a slug-keyed
 * map, missed on essentially every line, coerced the miss with `?? 0`, and
 * reported a net margin that omitted the largest cost in a food business.
 *
 * A miss must never be silent and must never be spelled `0`. Food does not
 * cost nothing, so a zero here is not a measurement — it is the absence of
 * one, and the two have to stay distinguishable all the way to the operator
 * reading the number. Hence `ResolvedUnitCost.basis`.
 *
 * This module is deliberately pure and DB-free: pass it rows, get an index.
 * That makes the resolution rules testable without a database, which is what
 * lets the regression that motivated it be pinned down in a unit test.
 */

/** The subset of a menu item this index needs. */
export interface MenuItemRef {
  slug: string;
  name: string;
  pricePaise: number;
}

/**
 * Margin assumed for a dish whose food cost we could not establish.
 *
 * NOTE: `menuEngineering.aggregateDishStats` carries its own copy of this
 * assumption (`opts.defaultMarginPct ?? 0.35`). The duplication is the same
 * root cause as the bug above — two places implementing one rule — and the
 * two should be unified onto this constant once the branches currently in
 * flight against `menuEngineering.ts` have landed.
 */
export const DEFAULT_FOOD_MARGIN_PCT = 0.35;

/**
 * Where a unit cost came from:
 * - `recipe`   — a real costed recipe. A measurement.
 * - `estimate` — no recipe cost; derived from the price via the default
 *                margin. Right order of magnitude, but an assumption.
 * - `none`     — no recipe cost and no price to estimate from. Contributes
 *                zero, which is wrong, and is counted so it can be said out
 *                loud rather than quietly flattering the margin.
 */
export type CostBasis = "recipe" | "estimate" | "none";

export interface ResolvedUnitCost {
  /** The menu-item slug the line resolved to, or null if nothing matched. */
  slug: string | null;
  costPaise: number;
  basis: CostBasis;
}

export interface DishCostIndex {
  /** normalized key -> slug. Built from both item names and item slugs. */
  slugByKey: Map<string, string>;
  /** Keys that two different dishes both claim; never resolved, to avoid guessing. */
  ambiguousKeys: Set<string>;
  /** slug -> food cost in paise. Only positive costs are stored. */
  costBySlug: Map<string, number>;
  /** slug -> catalog price, the fallback basis for an estimate. */
  pricePaiseBySlug: Map<string, number>;
  defaultMarginPct: number;
}

/**
 * Collapse a display name or a slug onto one key space.
 *
 * `"Quinoa Upma"`, `"quinoa-upma"` and `"Quinoa  Upma!"` all normalize to
 * `quinoa-upma`, so one lookup covers renames, punctuation drift, and the
 * legacy rows that stored a slug in the name field — no fallback chain, and
 * so no chance of the chain being got wrong somewhere else.
 */
export function normalizeDishKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildDishCostIndex(
  menuItems: readonly MenuItemRef[],
  recipeCostsBySlug: ReadonlyMap<string, number | null>,
  opts: { defaultMarginPct?: number } = {},
): DishCostIndex {
  const slugByKey = new Map<string, string>();
  const ambiguousKeys = new Set<string>();
  const costBySlug = new Map<string, number>();
  const pricePaiseBySlug = new Map<string, number>();

  const claim = (key: string, slug: string): void => {
    if (!key) return;
    const existing = slugByKey.get(key);
    if (existing === undefined) {
      slugByKey.set(key, slug);
    } else if (existing !== slug) {
      // Two dishes answer to the same key. Picking one would be a guess that
      // reads exactly like a measurement downstream, so we decline to resolve
      // it at all and let the caller fall back to an explicit estimate.
      ambiguousKeys.add(key);
    }
  };

  for (const item of menuItems) {
    claim(normalizeDishKey(item.name), item.slug);
    claim(normalizeDishKey(item.slug), item.slug);
    pricePaiseBySlug.set(item.slug, item.pricePaise);
  }

  for (const [slug, cost] of recipeCostsBySlug) {
    // A null or non-positive stored cost is an unknown, not a free dish.
    if (cost != null && cost > 0) costBySlug.set(slug, cost);
  }

  return {
    slugByKey,
    ambiguousKeys,
    costBySlug,
    pricePaiseBySlug,
    defaultMarginPct: opts.defaultMarginPct ?? DEFAULT_FOOD_MARGIN_PCT,
  };
}

/**
 * The food cost of one unit of the dish an order line names.
 *
 * `linePricePaise` is what the customer actually paid for one unit; it is the
 * preferred basis for an estimate because it already reflects any discount.
 * The catalog price is the fallback when the line carries no price.
 */
export function lookupUnitFoodCostPaise(
  index: DishCostIndex,
  rawName: string,
  linePricePaise = 0,
): ResolvedUnitCost {
  const key = normalizeDishKey(rawName);
  const slug = index.ambiguousKeys.has(key)
    ? null
    : (index.slugByKey.get(key) ?? null);

  if (slug !== null) {
    const cost = index.costBySlug.get(slug);
    if (cost != null && cost > 0) {
      return { slug, costPaise: cost, basis: "recipe" };
    }
  }

  const basisPaise =
    linePricePaise > 0
      ? linePricePaise
      : slug !== null
        ? (index.pricePaiseBySlug.get(slug) ?? 0)
        : 0;

  if (basisPaise <= 0) return { slug, costPaise: 0, basis: "none" };

  return {
    slug,
    costPaise: Math.max(
      0,
      Math.round(basisPaise * (1 - index.defaultMarginPct)),
    ),
    basis: "estimate",
  };
}
