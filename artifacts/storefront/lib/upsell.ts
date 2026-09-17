/**
 * What the cart drawer may offer as an upsell ("Recommended add-ons").
 *
 * Pure and DB/DOM-free because every rule here is a way to sell something we
 * cannot deliver. The rail this feeds used to ship its own INVENTED catalog —
 * four items with ids 901–904 that existed nowhere server-side. Adding one
 * put a phantom line in the persisted cart; checkout then excluded it (it is
 * a marketplace line) and pointed the customer at the marketplace to buy it —
 * where the product did not exist. A dead-end disguised as a recommendation,
 * priced with numbers no server ever quoted.
 *
 * T7 (CRO handoff, 2026-09-17): a cart with a MEAL in it is offered FOOD —
 * desserts, coolers and quick bites from the café catalog, each cheaper than
 * the cheapest meal already in the cart. A pantry jar next to a ₹349 pasta
 * is a category switch, not an add-on; a ₹119 cooler is. Pantry (marketplace)
 * items are offered only to a cart that holds nothing but pantry items.
 */
import type { DishData } from "@workspace/menu-catalog";
import type { MarketplaceItem } from "./marketplaceApi";
import type { CartLine } from "./cartStore";

/** The rail is a nudge, not a catalog — three is plenty. */
export const UPSELL_MAX = 3;

/**
 * Candidates = the REAL catalog, minus what cannot be honestly offered:
 *
 * - Items already in the cart — matched on marketplace lines ONLY. The old
 *   filter compared bare dishIds across kinds, so dish #3 in the cart would
 *   have suppressed marketplace item #3: ids from different tables are not
 *   comparable.
 * - Items with no stock. Offering an out-of-stock item recreates exactly the
 *   dead end this module exists to remove.
 *
 * Catalog order is preserved (the server's curation is the ranking); the
 * result is deterministic for a given catalog + cart.
 */
export function selectUpsellItems(
  items: readonly MarketplaceItem[],
  cartLines: readonly CartLine[],
  max: number = UPSELL_MAX,
): MarketplaceItem[] {
  const inCart = new Set(
    cartLines.filter((l) => l.kind === "marketplace").map((l) => l.dishId),
  );
  return items.filter((it) => it.stockQty > 0 && !inCart.has(it.id)).slice(0, max);
}

// ---- food add-ons (T7) ------------------------------------------------------

/** The slice of a dish the food recommender reads. `Pick` rather than the
 *  whole `DishData` so a test can build one without 30 fields, and so the
 *  function hands back the caller's own (fuller) type. */
export type UpsellDish = Pick<
  DishData,
  "id" | "slug" | "name" | "price" | "category" | "isAvailable" | "sectionOrder"
>;

/**
 * "Food" for the rail = the small, cheap, impulse end of the menu — never a
 * second main. Two signals, because the catalog carries both and neither
 * alone covers it:
 *
 * - `category`: the café additions (2026-09-17) are seeded as `snacks`
 *   (nachos, wings, corn balls — the quick bites) and `beverages` (coolers,
 *   fizzes, smoothies).
 * - `sectionOrder`: the §5 storefront sections 10 "Smoothies & Juices",
 *   11 "Desserts" and 12 "Sides & Sips". There is no `desserts` category —
 *   a dessert is a `snacks`/`breakfast` row governed into section 11 — so
 *   the section is the only way to name one.
 */
export const UPSELL_FOOD_CATEGORIES: ReadonlySet<DishData["category"]> = new Set([
  "snacks",
  "beverages",
]);
export const UPSELL_FOOD_SECTIONS: ReadonlySet<number> = new Set([10, 11, 12]);

export function isUpsellFood(dish: Pick<UpsellDish, "category" | "sectionOrder">): boolean {
  return (
    UPSELL_FOOD_CATEGORIES.has(dish.category) ||
    (dish.sectionOrder !== undefined && UPSELL_FOOD_SECTIONS.has(dish.sectionOrder))
  );
}

/** The cheapest MEAL in the cart — dish lines only, unit price (a ₹349 pasta
 *  at qty 3 is still a ₹349 meal). `null` when the cart holds no dish line. */
export function cheapestDishLinePaise(cartLines: readonly CartLine[]): number | null {
  let min: number | null = null;
  for (const l of cartLines) {
    if (l.kind !== "dish") continue;
    if (min === null || l.pricePaise < min) min = l.pricePaise;
  }
  return min;
}

/**
 * Food add-ons for a cart that holds at least one dish line:
 *
 * - food only (`isUpsellFood`), and available;
 * - not already in the cart — matched on DISH lines only, the same per-kind
 *   rule as the pantry selector;
 * - STRICTLY cheaper than the cheapest dish line's unit price. An add-on that
 *   costs as much as the meal is a second meal.
 *
 * Ordered by price ascending (the rail reads left-to-right and the first
 * card is the one that gets tapped — the cheapest nudge goes first), ties
 * broken by name then id so the result is deterministic. Capped at `max`.
 *
 * A cart with no dish line has no "cheapest meal" to price against and
 * yields nothing; `selectUpsell` routes that case.
 */
export function selectUpsellDishes<D extends UpsellDish>(
  dishes: readonly D[],
  cartLines: readonly CartLine[],
  max: number = UPSELL_MAX,
): D[] {
  const ceiling = cheapestDishLinePaise(cartLines);
  if (ceiling === null) return [];
  const inCart = new Set(cartLines.filter((l) => l.kind === "dish").map((l) => l.dishId));
  return dishes
    .filter((d) => d.isAvailable && isUpsellFood(d) && !inCart.has(d.id) && d.price < ceiling)
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name) || a.id - b.id)
    .slice(0, max);
}

export type UpsellSelection<D extends UpsellDish> =
  | { kind: "dish"; items: D[] }
  | { kind: "marketplace"; items: MarketplaceItem[] }
  | { kind: "none"; items: [] };

/**
 * Which rail a cart gets:
 *
 * - any dish line (dish-only or mixed) → food add-ons (`selectUpsellDishes`);
 * - only marketplace lines → pantry items (`selectUpsellItems`);
 * - empty cart → nothing. There is no meal to price food against, and a
 *   pantry rail under "Cart is empty." was selling groceries to someone who
 *   came for lunch.
 *
 * The drawer fetches only the catalog the selected kind needs; an absent
 * catalog (not loaded yet, or the fetch failed) yields an empty rail.
 */
export function selectUpsell<D extends UpsellDish>(input: {
  dishes: readonly D[] | undefined;
  marketplaceItems: readonly MarketplaceItem[] | undefined;
  cartLines: readonly CartLine[];
  max?: number;
}): UpsellSelection<D> {
  const { dishes, marketplaceItems, cartLines, max = UPSELL_MAX } = input;
  if (cartLines.length === 0) return { kind: "none", items: [] };
  if (cartLines.some((l) => l.kind === "dish")) {
    return { kind: "dish", items: selectUpsellDishes(dishes ?? [], cartLines, max) };
  }
  return { kind: "marketplace", items: selectUpsellItems(marketplaceItems ?? [], cartLines, max) };
}

/**
 * Where the rail may sit under the order — as px of extra top padding.
 *
 * The cart drawer's scroll region shows the order first and the rail after
 * it. With `room = capacityPx - orderPx` (the space left under the order
 * before the fold):
 *
 * - room >= railPx: the whole rail fits in view. No padding.
 * - room <= 0:      the order itself already needs scrolling, so the rail
 *                   sits entirely below the fold and is reached by scrolling
 *                   past the order. No padding.
 * - otherwise the fold would cut the rail — half a card peeking over the
 *   subtotal, the exact "add-ons overriding the order" look. So the rail is
 *   padded down until its CARD ROW starts at the fold: when the room holds
 *   the rail's header (`peekPx` — gap + box padding + label), the header
 *   peeks above the fold as the cue that add-ons sit below; when it does not
 *   even hold that, the whole rail starts at the fold. Either way the order
 *   keeps every pixel it had and no card is ever cut.
 *
 * Pure: the drawer measures, this decides. `railPx` and `peekPx` both include
 * the rail's gap above it; a rail of no height (nothing to offer) needs no
 * placing.
 */
export function upsellRailSpacerPx(input: {
  orderPx: number;
  railPx: number;
  capacityPx: number;
  /** Height of the rail's header (gap + box padding + label), 0 to never peek. */
  peekPx?: number;
}): number {
  const { orderPx, railPx, capacityPx, peekPx = 0 } = input;
  if (!(railPx > 0)) return 0;
  const room = capacityPx - orderPx;
  if (!Number.isFinite(room)) return 0;
  if (room <= 0 || room >= railPx) return 0;
  const peek = peekPx > 0 && peekPx < railPx ? peekPx : 0;
  // Round UP: a fractional layout must never leave a card straddling the fold.
  return Math.ceil(room >= peek ? room - peek : room);
}
