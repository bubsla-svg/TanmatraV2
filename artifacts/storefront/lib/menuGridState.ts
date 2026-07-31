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
