import { addLine, setQty, type CartState } from "./cartStore";
import type { OrderLineItem } from "./ordersApi";

/**
 * Reorder core (SF-09 tail / CUJ-09): re-seed the cart from a past order's
 * persisted lines against the CURRENT public menu, then the flow continues as
 * CUJ-01 from the cart step. Pure and node-testable.
 *
 * Rules:
 * - Only dishes still on the menu AND available are added — the server would
 *   422 (`dish_unavailable`) anything else at order time, so the cart never
 *   carries a line that can't be bought.
 * - Lines are priced at TODAY's server menu price, never the stored line price
 *   (that's history, not an offer — §4.3 display-only discipline holds).
 * - Anything not addable is reported back by name — dropped honestly, never
 *   silently (the no-silent-truncation rule).
 * - Quantities merge into the existing cart and clamp per cart rules.
 */

export interface ReorderMenuDish {
  id: number;
  slug: string;
  name: string;
  /** Today's server menu price, paise. */
  price: number;
  isAvailable?: boolean;
}

export interface ReorderResult {
  cart: CartState;
  /** Distinct order lines added to the cart. */
  added: number;
  /** Names of lines that could not be re-added (off menu / unavailable). */
  dropped: string[];
}

export function reorderIntoCart(
  current: CartState,
  items: readonly OrderLineItem[],
  menu: readonly ReorderMenuDish[],
): ReorderResult {
  const byId = new Map(menu.map((d) => [d.id, d]));
  let cart = current;
  let added = 0;
  const dropped: string[] = [];
  for (const it of items) {
    const dish = byId.get(it.id);
    if (!dish || dish.isAvailable === false) {
      dropped.push(it.name);
      continue;
    }
    const existingQty = cart.lines.find((l) => l.dishId === dish.id)?.qty ?? 0;
    cart = addLine(cart, {
      dishId: dish.id,
      slug: dish.slug,
      name: dish.name,
      pricePaise: dish.price,
    });
    // addLine bumped by 1; set the true merged quantity (clamped by the store).
    cart = setQty(cart, dish.id, existingQty + it.qty);
    added += 1;
  }
  return { cart, added, dropped };
}
