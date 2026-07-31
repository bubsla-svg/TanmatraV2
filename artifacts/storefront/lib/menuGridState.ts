import type { DishData } from "@workspace/menu-catalog";
import type { DishFit } from "./menuFit";
import { filterDishesByDiet, type DietFilterChip } from "./dietFilter";

export interface RankedDish {
  dish: DishData;
  fit: DishFit;
}

export interface MenuGridState {
  order: Map<number, number> | undefined;
  visibleIds: Set<number>;
  fits: Map<number, DishFit> | undefined;
}

/**
 * Pure derivation of what PersonalizedMenu hands down to MenuGrid: which
 * dish ids to show (diet-chip filter) and what order to lay them out in
 * (personalised ranking, when there is one) — the row markup itself is
 * pre-rendered server-side (app/menu/page.tsx) and never touched here.
 *
 * Extracted from the component so the CSS order/visibility wiring behind
 * OA-DEEP-1.8 is unit-testable without a DOM. `order` intentionally keeps
 * gaps for filtered-out dishes (it is a CSS flex `order` value, not an
 * array index) — flexbox sorts only the visible items by it, so a gap
 * from a hidden dish never shows up as a layout gap.
 */
export function computeMenuGridState(
  dishes: DishData[],
  ranked: RankedDish[] | null,
  chip: DietFilterChip,
): MenuGridState {
  const orderedDishes = ranked ? ranked.map((r) => r.dish) : dishes;
  const visibleIds = new Set(filterDishesByDiet(orderedDishes, chip).map((d) => d.id));
  const fits = ranked ? new Map(ranked.map((r) => [r.dish.id, r.fit])) : undefined;
  const order = ranked ? new Map(ranked.map((r, i) => [r.dish.id, i])) : undefined;
  return { order, visibleIds, fits };
}

/**
 * OA-MED-1.19 — `/menu` rendered every diet-filtered dish's DOM node at
 * once (~124 on the unfiltered "all" chip). `MenuGrid` already pays the
 * markup cost up front for every row (that is OA-DEEP-1.8's own documented
 * DOM-size/JS-size tradeoff), so pagination here only needs to decide which
 * ids get the `hidden` attribute — no row is (re)constructed.
 *
 * `limit` caps the count within `visibleIds` (diet-filter wins first), and
 * ranked dishes are capped in ranked order rather than raw row order so
 * "first N" matches what the user actually sees at the top of the list.
 */
export function capVisibleIds(
  rowIds: number[],
  order: Map<number, number> | undefined,
  visibleIds: Set<number>,
  limit: number,
): Set<number> {
  const visible = rowIds.filter((id) => visibleIds.has(id));
  const ranked = order ? [...visible].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) : visible;
  return new Set(ranked.slice(0, limit));
}
