"use client";
// "use client" justification: reads live cart state; hosts the cart drawer
// open state (local, not URL — a cart is not shareable state).
// Stitch dark scope (component-scoped — the bar floats over light and dark
// routes alike, so data-stitch sits on the bar root, not a page wrapper) —
// see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
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
 *
 * `bottom-16` is the shared bottom-bar band — the same offset DishBuyBar,
 * CheckoutPay, AlacarteDetails, PlanDetails, TrialStart, VoucherRedeem and
 * BridgeView all sit at, so handing the edge from any of them to this bar
 * doesn't move it. It used to be `bottom-14` (56px), left over from a
 * BottomNav of that height that no longer exists — today's MobileBottomNav
 * row is `h-16`, and the 8px mismatch showed as a visible jump the moment
 * DishBuyBar swapped out for this bar.
 */
export function MiniCartBar() {
  const { cart, hydrated } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const count = itemCount(cart);

  if (!hydrated || count === 0 || pathname.startsWith("/checkout")) return null;

  return (
    <>
      <div data-stitch="dark" className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] text-ink backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="tabular text-sm text-ink">
            <span className="font-semibold">{count}</span>{" "}
            {count === 1 ? "item" : "items"}{" "}
            <span aria-hidden className="text-ink-faint">·</span>{" "}
            <span className="tabular font-semibold">{formatPaise(subtotalPaise(cart))}</span>
          </p>
          <Button
            type="button"
            onClick={() => setDrawerOpen(true)}
            shape="pill" size="fluid" className="min-h-11 px-5 py-2 font-semibold"
          >
            View cart
          </Button>
        </div>
      </div>
      <CartDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
