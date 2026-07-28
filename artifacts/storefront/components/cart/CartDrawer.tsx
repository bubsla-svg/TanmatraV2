"use client";
// "use client" justification: interactive cart surface (steppers, drawer).
import type { ReactNode } from "react";
import { addLine, qtyOf, setQty, subtotalPaise } from "@/lib/cartStore";
import { formatPaise } from "@/lib/format";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";
import { useCart } from "@/components/cart/CartProvider";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { CartUpsellRail, type UpsellCandidate } from "./CartUpsellRail";

/**
 * Cart as a bottom sheet (§4.3). Line items with in-place steppers; the
 * subtotal is display-only (server owns the billed amount at order create).
 * The checkout CTA sits behind the named NEXT_PUBLIC_LIVE_CHECKOUT flag and
 * fails LOUD when dark (visible "not yet live" state, per the LIVE-CUTOVER
 * pattern) — never a dead button, never a silent advance.
 */
export function CartDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { cart, setCart } = useCart();

  let footer: ReactNode;
  if (LIVE_CHECKOUT_ENABLED) {
    footer = (
      <a
        href="/checkout?mode=alacarte"
        className="block min-h-11 rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
      >
        Checkout
      </a>
    );
  } else {
    footer = (
      <p role="status" className="rounded-lg border border-line bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
        Checkout goes live with the payment slice — your cart is saved.
      </p>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <div className="flex min-h-0 flex-col px-4 pb-6 pt-3">
          <DrawerTitle className="text-lg font-semibold text-ink">Your cart</DrawerTitle>
          <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
            {cart.lines.map((l) => (
              <li key={`${l.kind}-${l.dishId}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                  <p className="tabular text-xs text-ink-muted">{formatPaise(l.pricePaise)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-line-strong" role="group" aria-label={`${l.name} quantity`}>
                    <button type="button" aria-label="Decrease" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind) - 1))} className="min-h-10 min-w-10 text-ink">−</button>
                    <span aria-live="polite" className="tabular min-w-6 text-center text-sm font-semibold text-ink">{l.qty}</span>
                    <button type="button" aria-label="Increase" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind) + 1))} className="min-h-10 min-w-10 text-ink">+</button>
                  </div>
                  <span className="tabular w-16 text-right text-sm font-semibold text-ink">
                    {formatPaise(l.pricePaise * l.qty)}
                  </span>
                </div>
              </li>
            ))}
            {cart.lines.length === 0 && (
              <li className="py-6 text-center text-sm text-ink-muted">Cart is empty.</li>
            )}
          </ul>
          <CartUpsellRail
            cartLines={cart.lines}
            onAdd={(item: UpsellCandidate) => {
              setCart(
                addLine(cart, {
                  dishId: item.dishId,
                  slug: item.slug,
                  name: item.name,
                  pricePaise: item.pricePaise,
                  kind: item.kind,
                })
              );
            }}
          />
          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-ink-muted">Subtotal (before delivery &amp; GST)</span>
              <span className="tabular font-semibold text-ink">{formatPaise(subtotalPaise(cart))}</span>
            </div>
            {footer}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
