"use client";
// "use client" justification: reads live cart state; renders the cart drawer
// (whose open state is provider-held, not URL — a cart is not shareable
// state, and the dish sheet needs to open it too; see CartProvider).
// Stitch dark scope (component-scoped — the bar floats over light and dark
// routes alike, so data-stitch sits on the bar root, not a page wrapper) —
// see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { itemCount, subtotalPaise } from "@/lib/cartStore";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/components/cart/CartProvider";
import { useScrollHide } from "@/lib/useScrollHide";
import { StickyAction } from "@/components/primitives/StickyAction";

// CartDrawer pulls in the Drawer primitive (Vaul — drag-physics + portal +
// focus management, see components/ui/drawer.tsx) plus CartUpsellRail. A
// static import here would ship all of that in the baseline JS for every
// route, since MiniCartBar is mounted globally in app/layout.tsx — most
// visits never open the drawer. Loaded on demand instead.
const CART_BAR_HIDDEN_ROUTES = ["/plans", "/plan", "/trial", "/account"];

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
  // Same shared hook (and therefore the same thresholds) MobileBottomNav
  // uses to slide away: when the tab bar retreats, this pill FOLLOWS it down
  // into the freed 64px band instead of hovering over a dead gap. The pill
  // itself never hides — it is the money path — it just refuses to reserve
  // two bars' worth of bottom edge when only one is on screen.
  const navRetreated = useScrollHide(cartOpen);
  const pathname = usePathname();

  if (!hydrated || count === 0) return null;
  // T-24: on plan-selection, trial and account pages this pill competed with
  // the page's own pinned CTA ("Select plan", "Send code") for the same
  // bottom band — two money bars stacked. The cart is untouched and comes
  // back the moment the customer leaves for a browsing surface. /menu,
  // /dish and /marketplace keep it: that is where quantities get decided.
  if (CART_BAR_HIDDEN_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

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
      <StickyAction
        chrome="none"
        safeArea={false}
        data-stitch="dark"
        className={`pointer-events-none bottom-16 z-30 px-3 text-ink transition-transform duration-200 motion-reduce:transition-none md:bottom-0 md:px-4 md:pb-[max(env(safe-area-inset-bottom),1rem)] ${
          navRetreated
            ? "translate-y-14 pb-[max(env(safe-area-inset-bottom),0.375rem)] md:translate-y-0"
            : "translate-y-0 pb-1.5"
        }`}
      >
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-full border border-line bg-glass py-1.5 pl-5 pr-1.5 shadow-lg backdrop-blur">
          {/* Live: adding announced only the stepper's "1" — the count and the
              money changed silently for a screen reader (2026-09-06 audit). */}
          <p aria-live="polite" aria-atomic="true" className="tabular text-sm text-ink">
            <span className="font-semibold">{count}</span>{" "}
            {count === 1 ? "item" : "items"}{" "}
            <span aria-hidden className="text-ink-faint">·</span>{" "}
            <span className="font-data font-bold text-primary">{formatPaise(subtotalPaise(cart))}</span>
          </p>
          <Button
            type="button"
            onClick={() => setCartOpen(true)}
            shape="pill" size="fluid" className="min-h-11 px-5 py-2 font-semibold"
          >
            View cart
          </Button>
        </div>
      </StickyAction>
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
