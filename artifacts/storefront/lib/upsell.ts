/**
 * Which marketplace items may the cart drawer offer as an upsell.
 *
 * Pure and DB/DOM-free because every rule here is a way to sell something we
 * cannot deliver. The rail this feeds used to ship its own INVENTED catalog —
 * four items with ids 901–904 that existed nowhere server-side. Adding one
 * put a phantom line in the persisted cart; checkout then excluded it (it is
 * a marketplace line) and pointed the customer at the marketplace to buy it —
 * where the product did not exist. A dead-end disguised as a recommendation,
 * priced with numbers no server ever quoted.
 */
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
