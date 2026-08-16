"use client";
// "use client" justification: reads live cart state; renders the cart drawer
// (whose open state is provider-held, not URL — a cart is not shareable
// state, and the dish sheet needs to open it too; see CartProvider).
// Stitch dark scope (component-scoped — the bar floats over light and dark
// routes alike, so data-stitch sits on the bar root, not a page wrapper) —
// see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { itemCount, subtotalPaise } from "@/lib/cartStore";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/cart/CartProvider";

// CartDrawer pulls in the Drawer primitive (Vaul — drag-physics + portal +
// focus management, see components/ui/drawer.tsx) plus CartUpsellRail. A
// static import here would ship all of that in the baseline JS for every
// route, since MiniCartBar is mounted globally in app/layout.tsx — most
// visits never open the drawer. Loaded on demand instead.
const CartDrawer = dynamic(
  () => import("@/components/cart/CartDrawer").then((m) => m.CartDrawer),
  { ssr: false },
);

/**
 * Persistent mini-cart bar (§4.1/§4.3): once the cart is non-empty, a fixed
 * bottom bar shows count + display subtotal + "View cart" — the aggregator
 * pattern NCR users expect. Mounts only from app/(global)/layout.tsx, so it
 * structurally never renders on /checkout or any other (focus)/(b2b) route —
 * those shells own their bottom edge (their money bars anchor at bottom-0).
 * Subtotal is display-only; the billed amount is always the server's.
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
  // Open state now lives in CartProvider, not here: the dish drawer's
  // post-add CTA also opens this drawer, and its overlay covers this bar —
  // see CartProvider's `cartOpen` note.
  const { cart, hydrated, cartOpen, setCartOpen } = useCart();
  const count = itemCount(cart);

  if (!hydrated || count === 0) return null;

  // Band anchor: `bottom-16` clears the global tab bar, which always renders
  // in the (global) shell this bar mounts in. (Focus routes take the bottom
  // edge themselves — this bar never exists there to need a bottom-0 arm.)
  //
  // A floating PILL inside that band, not an edge-to-edge slab (owner
  // feedback 2026-08-16: the full-width opaque banner + the tab bar
  // letterboxed the product list into a strip). The band anchor is
  // unchanged — the pill's top edge sits where the slab's did, so the
  // DishBuyBar→this handoff still doesn't jump — but content now shows
  // around three sides, the full-width top border is gone, and the bar reads
  // as a chip floating OVER the list instead of a wall closing it off.
  // Mobile needs no safe-area padding (the tab bar below owns that inset);
  // md floats the pill off the naked bottom edge, where it does.
  return (
    <>
      <div
        data-stitch="dark"
        className="pointer-events-none fixed inset-x-0 bottom-16 z-30 px-3 pb-1.5 text-ink md:bottom-0 md:px-4 md:pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-line bg-[var(--glass)] py-1.5 pl-5 pr-1.5 shadow-lg backdrop-blur">
          <p className="tabular text-sm text-ink">
            <span className="font-semibold">{count}</span>{" "}
            {count === 1 ? "item" : "items"}{" "}
            <span aria-hidden className="text-ink-faint">·</span>{" "}
            <span className="tabular font-semibold">{formatPaise(subtotalPaise(cart))}</span>
          </p>
          <Button
            type="button"
            onClick={() => setCartOpen(true)}
            shape="pill" size="fluid" className="min-h-11 px-5 py-2 font-semibold"
          >
            View cart
          </Button>
        </div>
      </div>
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
