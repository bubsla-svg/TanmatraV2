"use client";
// "use client" justification: interactive cart surface (steppers, drawer).
// Stitch dark scope (component-scoped — the sheet floats over light and dark
// routes alike, so data-stitch sits on the sheet root, not a page wrapper) —
// see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { addLine, qtyOf, setQty, subtotalPaise } from "@/lib/cartStore";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";
import { fetchQuote, type QuoteSnapshot } from "@/lib/quoteApi";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";
import { CartUpsellRail } from "./CartUpsellRail";
import type { MarketplaceItem } from "@/lib/marketplaceApi";

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
  const { cart, setCart, hydrated } = useCart();

  // Back gesture closes the drawer, not the page (Vaul owns the slide;
  // history ownership lives here).
  useOverlayHistory(open, () => onOpenChange(false));

  // N5.2 — the ₹50→₹112 ambush. Checkout renders "Add ₹X more for free
  // delivery" from the server quote, but the CART never did: a customer
  // first learned a delivery fee existed on the pay screen, +124% over the
  // subtotal they had just been shown. The threshold signal belongs at the
  // moment quantities are still being decided — here.
  //
  // Same source of truth as checkout: POST /orders/quote, dish-kind lines
  // only, the identical item mapping AlacarteCheckout uses. Never derived
  // client-side. On any failure the hint simply doesn't render (status quo
  // ante) — a cart must keep working with the API down.
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const quoteSeq = useRef(0);
  const dishKey = JSON.stringify(
    cart.lines
      .filter((l) => l.kind === "dish")
      .map((l) => [l.dishId, l.qty, l.customizationSelections ?? null]),
  );
  useEffect(() => {
    const dishLines = cart.lines.filter((l) => l.kind === "dish");
    if (!open || dishLines.length === 0) {
      setQuote(null);
      return;
    }
    const seq = ++quoteSeq.current;
    // Debounced — steppers click fast, and each click is a priced input.
    const id = setTimeout(() => {
      fetchQuote(
        dishLines.map((l) => ({
          dishId: l.dishId,
          qty: l.qty,
          ...(l.customizationSelections && l.customizationSelections.length > 0
            ? { customizations: l.customizationSelections }
            : {}),
        })),
      )
        .then((q) => {
          if (seq === quoteSeq.current) setQuote(q);
        })
        .catch(() => {
          if (seq === quoteSeq.current) setQuote(null);
        });
    }, 350);
    return () => clearTimeout(id);
    // dishKey is the serialised priced inputs — lines/qty/customisations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dishKey]);

  let footer: ReactNode;
  if (LIVE_CHECKOUT_ENABLED) {
    footer = (
      <Button asChild shape="pill" size="fluid" className="block min-h-11 px-5 py-3 text-center font-semibold">
        {/* prefetch: the only link in the storefront where the next step is
            near-certain — this renders in an open cart drawer with items in
            it. Everywhere else the default (the loading shell for a dynamic
            route) is right, because a menu of ~100 dishes would fire one
            full RSC render per visible card. */}
        <Link href="/checkout?mode=alacarte" prefetch>Checkout</Link>
      </Button>
    );
  } else {
    footer = (
      <p role="status" className="rounded-2xl border border-line bg-surface-raised px-4 py-3 text-center text-xs text-ink-muted">
        Checkout goes live with the payment slice — your cart is saved.
      </p>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* data-stitch on the sheet root itself: the drawer floats over light and
          dark routes, so its token subtree goes dark everywhere. The sheet's
          own bg/border live in the shared ui/drawer primitive (bg-surface +
          hairline border-line — opaque, not the mock's /95+blur). */}
      <DrawerContent aria-describedby={undefined} data-stitch="dark" data-ui-generation="stitch-74" data-screen-id="5.6" data-screen-state="cart-drawer-open">
        <div className="flex min-h-0 flex-col px-4 pb-6 pt-3">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-lg font-semibold text-ink">Your cart</DrawerTitle>
            {/* T-01: an explicit ≥44px Close — the sheet used to offer only a
                drag handle and the back gesture. Backdrop tap and Escape still
                dismiss (Vaul owns those); this adds the thumb-reachable one. */}
            <DrawerClose
              aria-label="Close cart"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-transform active:scale-95"
            >
              <span aria-hidden className="text-xl leading-none">✕</span>
            </DrawerClose>
          </div>
          <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
            {cart.lines.map((l) => (
              <li key={`${l.kind}-${l.dishId}-${(l.customizations ?? []).join("|")}`} className="flex items-start justify-between gap-3 py-3">
                {/* `items-start`, not `items-center`: once the name is allowed
                    two lines the text column is taller than the stepper, and
                    centring floated the controls against the middle of a
                    two-line title. */}
                <div className="min-w-0">
                  {/* Wraps to two lines rather than truncating to one. A cart
                      is the last surface that may be ambiguous about what is
                      being bought — "Grilled Paneer Tikka with Quinoa…" and
                      "Grilled Paneer Tikka with Millet…" clipped to the same
                      string — and vertical space in a drawer is free. */}
                  <p className="line-clamp-2 text-sm font-medium text-ink">{l.name}</p>
                  {l.customizations && l.customizations.length > 0 && (
                    <p className="line-clamp-2 text-xs text-ink-muted">{l.customizations.join(", ")}</p>
                  )}
                  {/* N5.8: at qty 1 the unit price IS the line total on the
                      right — printing ₹50 twice for one smoothie read as a
                      glitch. The unit price earns its row only once it's
                      arithmetic input (qty > 1). */}
                  {l.qty > 1 && (
                    <p className="tabular text-xs text-ink-muted">{formatPaise(l.pricePaise)} each</p>
                  )}
                  {/* D-14: "Andaaza nahi, likha hua" — the same figures the
                      menu card shows, absent only for a line with none captured
                      (marketplace items, or a cart written before this field
                      existed). "~" prefix matches DishCard/PDP's own convention. */}
                  {l.macros && (
                    <p className="tabular text-xs text-ink-faint">
                      {formatMacroLine(l.macros, l.macros.estimated, l.macros.provisional)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-full border border-line bg-surface-raised" role="group" aria-label={`${l.name} quantity`}>
                    <button type="button" aria-label="Decrease" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind, l.customizations) - 1, l.customizations))} className="min-h-10 min-w-10 rounded-full text-ink transition-transform active:scale-[0.98]">−</button>
                    <span aria-live="polite" className="tabular min-w-6 text-center text-sm font-semibold text-ink">{l.qty}</span>
                    <button type="button" aria-label="Increase" onClick={() => setCart(setQty(cart, l.dishId, l.kind, qtyOf(cart, l.dishId, l.kind, l.customizations) + 1, l.customizations))} className="min-h-10 min-w-10 rounded-full text-ink transition-transform active:scale-[0.98]">+</button>
                  </div>
                  <span className="tabular w-16 text-right text-sm font-semibold text-ink">
                    {formatPaise(l.pricePaise * l.qty)}
                  </span>
                </div>
              </li>
            ))}
            {/* Law 10: "Cart is empty." is only true once the stored cart has
                actually been read. CartProvider seeds EMPTY_CART and fills it
                in a post-mount effect, so asserting emptiness before `hydrated`
                tells someone who DOES have items that they have none — a void
                state that lies rather than one that is merely blank.
                MiniCartBar already guards on `hydrated`; this sibling did not. */}
            {!hydrated && (
              <li
                data-screen-state="cart-loading"
                aria-hidden
                className="flex flex-col gap-3 py-6"
              >
                {[0, 1].map((i) => (
                  <span key={i} className="h-12 animate-pulse rounded-2xl bg-surface-raised" />
                ))}
              </li>
            )}
            {hydrated && cart.lines.length === 0 && (
              <li data-ui-generation="stitch-74" data-screen-id="14.1" data-screen-state="cart-empty" className="py-6 text-center text-sm text-ink-muted">Cart is empty.</li>
            )}
          </ul>
          {/* Real catalog items, same line shape as MarketplaceGrid's add —
              ids/slugs/prices all resolve server-side (the rail used to add
              invented items checkout could only dead-end on). */}
          <CartUpsellRail
            cartLines={cart.lines}
            onAdd={(item: MarketplaceItem) => {
              setCart(
                addLine(cart, {
                  dishId: item.id,
                  kind: "marketplace",
                  slug: item.slug,
                  name: item.name,
                  pricePaise: item.pricePaise,
                })
              );
            }}
          />
          <div className="mt-3 border-t border-line pt-3">
            {/* N5.2 — the fee is disclosed HERE, while quantities are still
                being decided, not sprung on the pay screen. Every number is
                the server quote's; the progress-bar width is the only derived
                value and it states no amount. */}
            {quote && quote.deliveryFeePaise > 0 && quote.amountToFreeDeliveryPaise > 0 && (
              <div className="mb-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink-muted">
                    Delivery <span className="tabular font-semibold text-ink">{formatPaise(quote.deliveryFeePaise)}</span>
                  </span>
                  <span className="text-ink">
                    Add <span className="tabular font-semibold">{formatPaise(quote.amountToFreeDeliveryPaise)}</span> more for free delivery
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (quote.subtotalPaise * 100) /
                            (quote.subtotalPaise + quote.amountToFreeDeliveryPaise),
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {quote && quote.deliveryFeePaise === 0 && cart.lines.length > 0 && (
              <p className="mb-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-center text-xs font-medium text-sage-text">
                Free delivery unlocked
              </p>
            )}
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Subtotal (before delivery &amp; GST)</span>
              <span className="tabular text-base font-semibold text-ink">{formatPaise(subtotalPaise(cart))}</span>
            </div>
            {footer}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
