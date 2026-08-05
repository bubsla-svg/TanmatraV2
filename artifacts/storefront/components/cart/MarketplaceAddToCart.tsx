"use client";

import { useCart } from "@/components/cart/CartProvider";
import { addLine, qtyOf, setQty } from "@/lib/cartStore";
import type { MarketplaceItem } from "@/lib/marketplaceApi";

export function MarketplaceAddToCart({ item }: { item: MarketplaceItem }) {
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
        className="min-h-11 rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-bold tracking-tight text-[#111318] hover:bg-[#D4AF37]/90 transition-transform active:scale-[0.98]"
      >
        Add to Order
      </button>
    );
  }

  return (
    <div className="flex items-center rounded-full border border-line-strong bg-surface h-[44px]" role="group" aria-label={`${item.name} quantity`}>
      <button 
        type="button" 
        aria-label="Decrease quantity" 
        onClick={(e) => { e.preventDefault(); setCart(setQty(cart, item.id, "marketplace", qty - 1)); }} 
        className="h-full w-12 flex items-center justify-center text-lg font-semibold text-ink transition-transform active:scale-[0.98]"
      >
        −
      </button>
      <span aria-live="polite" className="tabular min-w-[24px] text-center text-sm font-semibold text-ink">{qty}</span>
      <button 
        type="button" 
        aria-label="Increase quantity" 
        onClick={(e) => { e.preventDefault(); setCart(setQty(cart, item.id, "marketplace", qty + 1)); }} 
        className="h-full w-12 flex items-center justify-center text-lg font-semibold text-ink transition-transform active:scale-[0.98]"
      >
        +
      </button>
    </div>
  );
}
