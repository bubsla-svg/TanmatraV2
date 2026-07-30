"use client";
// "use client" justification: cart-aware visibility + sticky viewport bar —
// reads live cart state to yield the bottom edge to MiniCartBar the moment
// the cart is non-empty.
import type { DishData } from "@workspace/menu-catalog";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { useCart } from "@/components/cart/CartProvider";
import { AddToCart } from "@/components/cart/AddToCart";
import { formatPaise } from "@/lib/format";

/**
 * Sticky buy bar for the dish PDP: name + display price on the left, one-tap
 * AddToCart on the right. Renders only while the cart is EMPTY — once any
 * line exists, MiniCartBar owns the bottom edge (no overlap). Also hidden for
 * dishes outside the à la carte hero set. Price is display-only via
 * formatPaise; the server re-prices at /orders (money path).
 */
export function DishBuyBar({ dish }: { dish: DishData }) {
  const { cart } = useCart();

  if (cart.lines.length > 0 || !isAlaCarteEnabled(dish)) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{dish.name}</p>
          <p className="font-mono text-sm text-gold-text">{formatPaise(dish.price)}</p>
        </div>
        <AddToCart dish={dish} />
      </div>
    </div>
  );
}
