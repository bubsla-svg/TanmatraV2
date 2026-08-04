"use client";
// "use client" justification: reads live cart state to enforce the
// one-primary-CTA-per-screen law on the PDP.
import type { DishData } from "@workspace/menu-catalog";
import { AddToCart } from "@/components/cart/AddToCart";
import { useCart } from "@/components/cart/CartProvider";

/**
 * The PDP header's AddToCart, gated so the page never shows two identical
 * primary buy actions at once.
 *
 * The bottom edge and the header trade ownership of the SINGLE primary:
 *   - cart EMPTY   → DishBuyBar (sticky, thumb-zone) carries the one gold
 *     AddToCart; this header slot renders nothing.
 *   - cart NON-EMPTY → DishBuyBar yields to MiniCartBar (an aggregate
 *     "View cart", navigation not a competing buy action) and THIS becomes
 *     the page's one AddToCart.
 *
 * Before this gate both rendered together on an empty cart — two identical
 * gold primaries for the same dish in one viewport. The `hydrated` guard
 * mirrors MiniCartBar's: the server (and first client) paint assume the
 * empty-cart arm, so the handoff never flashes both.
 */
export function PdpAddToCart({ dish }: { dish: DishData }) {
  const { cart, hydrated } = useCart();
  if (!hydrated || cart.lines.length === 0) return null;
  return <AddToCart dish={dish} />;
}
