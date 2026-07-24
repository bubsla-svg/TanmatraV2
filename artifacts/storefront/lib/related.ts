import type { DishData } from "@workspace/menu-catalog";

/** A dish is orderable/browsable unless the catalog explicitly marks it out. */
function isAvailable(dish: DishData): boolean {
  return dish.isAvailable !== false;
}

/**
 * Resolve a dish's explicit `pairingSlug` to a real, available dish. Returns
 * undefined when the field is unset, points at the dish itself, names a dish
 * not in the catalog, or names one that's currently unavailable — so the PDP
 * never renders a dead "pairs well with" card.
 */
export function resolvePairing(dish: DishData, all: DishData[]): DishData | undefined {
  if (!dish.pairingSlug || dish.pairingSlug === dish.slug) return undefined;
  const found = all.find((d) => d.slug === dish.pairingSlug);
  return found && isAvailable(found) ? found : undefined;
}

/**
 * Up to `limit` other dishes from the same category, for the PDP "more like
 * this" rail. Excludes the dish itself, anything unavailable, and (when given)
 * the already-surfaced pairing so the two rails never repeat a dish. Preserves
 * the incoming catalog order — the public menu is already RD-ranked upstream,
 * so this only filters and caps, it never re-sorts.
 */
export function relatedDishes(
  dish: DishData,
  all: DishData[],
  limit = 3,
  excludeSlug?: string,
): DishData[] {
  return all
    .filter(
      (d) =>
        d.slug !== dish.slug &&
        d.slug !== excludeSlug &&
        d.category === dish.category &&
        isAvailable(d),
    )
    .slice(0, limit);
}

export interface DishCrossSell {
  pairing?: DishData;
  related: DishData[];
}

/** One call for the PDP: the explicit pairing plus same-category related dishes
 *  (with the pairing excluded from `related`). */
export function dishCrossSell(dish: DishData, all: DishData[], limit = 3): DishCrossSell {
  const pairing = resolvePairing(dish, all);
  return { pairing, related: relatedDishes(dish, all, limit, pairing?.slug) };
}
