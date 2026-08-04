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
