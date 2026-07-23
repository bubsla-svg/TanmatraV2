"use client";
// "use client" justification: reads live cart state; hosts the cart drawer
// open state (local, not URL — a cart is not shareable state).
import { useState } from "react";
import { usePathname } from "next/navigation";
import { itemCount, subtotalPaise } from "@/lib/cartStore";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";

/**
 * Persistent mini-cart bar (§4.1/§4.3): once the cart is non-empty, a fixed
 * bottom bar shows count + display subtotal + "View cart" — the aggregator
 * pattern NCR users expect. Hidden on /checkout (its own money surface owns
 * the total there). Subtotal is display-only; the billed amount is always
 * the server's.
 */
export function MiniCartBar() {
  const { cart, hydrated } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const count = itemCount(cart);

  if (!hydrated || count === 0 || pathname.startsWith("/checkout")) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">{count}</span>{" "}
            {count === 1 ? "item" : "items"}{" "}
            <span aria-hidden className="text-ink-faint">·</span>{" "}
            <span className="tabular font-semibold">{formatPaise(subtotalPaise(cart))}</span>
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-h-11 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            View cart
          </button>
        </div>
      </div>
      <CartDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
