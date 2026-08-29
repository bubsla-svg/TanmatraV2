"use client";

import { useCart } from "@/components/cart/CartProvider";
import { addLine, qtyOf, setQty } from "@/lib/cartStore";
import type { MarketplaceItem } from "@/lib/marketplaceApi";

export function MarketplaceAddToCart({
  item,
  variant = "pdp",
}: {
  item: MarketplaceItem;
  /**
   * "pdp" is the shipped product-page treatment (solid-gold pill). "card" is
   * for listing/rail cards, mirroring the dish card's D-08 grammar exactly
   * (see AddToCart.tsx): OUTLINE gold, full width — every card can carry the
   * purchase colour while the mini-cart bar / drawer Checkout / PDP Add stay
   * the viewport's one solid-gold forward action. Before this, marketplace
   * cards had no add control at all — quantity lived only on the PDP or in
   * the cart drawer, one navigation away from the browse moment.
   */
  variant?: "pdp" | "card";
}) {
  const { cart, setCart } = useCart();
  const qty = qtyOf(cart, item.id, "marketplace");
  const line = {
    dishId: item.id,
    kind: "marketplace" as const,
    slug: item.slug,
    name: item.name,
    pricePaise: item.pricePaise
  };

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setCart(addLine(cart, line));
        }}
        className={
          variant === "card"
            ? "min-h-11 w-full rounded-lg border border-gold bg-surface px-4 py-2 text-sm font-bold text-gold-text transition-transform active:scale-[0.98]"
            : "min-h-11 rounded-full bg-gold px-6 py-2 text-sm font-bold tracking-tight text-[var(--gold-ink)] hover:bg-gold/90 transition-transform active:scale-[0.98]"
        }
      >
        {variant === "card" ? "Add" : "Add to Order"}
      </button>
    );
  }

  return (
    <div
      className={
        variant === "card"
          ? "flex h-11 w-full items-center justify-between rounded-lg border border-gold bg-surface"
          : "flex items-center rounded-full border border-line-strong bg-surface h-[44px]"
      }
      role="group"
      aria-label={`${item.name} quantity`}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={(e) => { e.preventDefault(); setCart(setQty(cart, item.id, "marketplace", qty - 1)); }}
        className={`h-full w-12 flex items-center justify-center text-lg font-semibold transition-transform active:scale-[0.98] ${variant === "card" ? "text-gold-text" : "text-ink"}`}
      >
        −
      </button>
      <span aria-live="polite" className="tabular min-w-[24px] text-center text-sm font-semibold text-ink">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={(e) => { e.preventDefault(); setCart(setQty(cart, item.id, "marketplace", qty + 1)); }}
        className={`h-full w-12 flex items-center justify-center text-lg font-semibold transition-transform active:scale-[0.98] ${variant === "card" ? "text-gold-text" : "text-ink"}`}
      >
        +
      </button>
    </div>
  );
}
