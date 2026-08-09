"use client";
// "use client" justification: reads live cart state to decide whether the PDP
// needs to surface a route onward to checkout.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";
import { itemCount, subtotalPaise } from "@/lib/cartStore";
import { formatPaise } from "@/lib/format";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";

/**
 * The dish PDP's route onward to the cart.
 *
 * `/dish/[slug]` lives in `app/(focus)/`, whose shell renders no Header, no
 * MobileBottomNav, no Footer and — critically — no MiniCartBar. That is
 * deliberate: each focus flow owns its own bottom edge. But MiniCartBar is
 * the aggregate "N items · ₹X · View cart" bar that every `app/(global)/`
 * route inherits as its way into checkout, and DishBuyBar's design assumed
 * it would take over the edge here too ("once any line exists, MiniCartBar
 * owns the bottom edge"). On a focus route it never mounts, so that handoff
 * had nothing to hand off to.
 *
 * The result was a dead end: add a dish from the PDP and you got a quantity
 * stepper and nothing else — no cart link, no tab bar, no header, no back
 * affordance. Browser Back was the only exit, and the cart you had just
 * added to was unreachable from the page that added to it. The PDP is a
 * genuinely reachable surface (DishDrawer's "full details", protocol rails,
 * saved favourites, meal guides, and the sitemap), not a dead route.
 *
 * This is that missing affordance, scoped to the one shell that cannot
 * inherit it. Subtotal shown here is display-only — the server owns the
 * billed amount at order create, same contract as MiniCartBar.
 */
export function PdpCartLink() {
  const { cart, hydrated } = useCart();
  const count = itemCount(cart);

  // Same hydration gate as MiniCartBar and DishBuyBar: the cart reads EMPTY
  // on the server render and the first client render alike (the persisted
  // cart only loads after mount — see CartProvider), so rendering before
  // hydration resolves would flash "no cart" at a visitor who has one.
  if (!hydrated || count === 0) return null;

  const summary = `${count} ${count === 1 ? "item" : "items"} · ${formatPaise(subtotalPaise(cart))}`;

  // Fails LOUD when the flag is dark, matching CartDrawer's footer — a
  // visible "not yet live" state, never a dead button that silently does
  // nothing.
  if (!LIVE_CHECKOUT_ENABLED) {
    return (
      <p
        role="status"
        className="mt-3 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-center text-xs text-ink-muted"
      >
        {summary} in your cart. Checkout goes live with the payment slice — your cart is saved.
      </p>
    );
  }

  return (
    <Button
      asChild
      shape="pill"
      size="fluid"
      className="mt-3 block min-h-11 w-full px-5 py-3 text-center font-semibold"
    >
      <Link href="/checkout?mode=alacarte">View cart · {summary}</Link>
    </Button>
  );
}
