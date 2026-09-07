"use client";
// Client: a link, but a stateful one — it reads the live cart to know how many
// of this item the customer means, so "use client" is unavoidable.
//
// This used to run the whole marketplace money path in place (server order →
// Razorpay modal → verify), which made the PDP a fourth checkout with its own
// auth gate and — the part that mattered — no captured-but-unverified state at
// all. It now routes to /checkout, where every purchase in the app settles.
import Link from "next/link";
import { qtyOf } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { checkoutHref } from "@/lib/checkoutIntent";
import type { MarketplaceItem } from "@/lib/marketplaceApi";

export function MarketplaceBuyNow({ item }: { item: MarketplaceItem }) {
  const { cart } = useCart();
  // The quantity already reflected in this item's cart stepper (1 if not yet
  // added), so the two controls never disagree on how many the customer means.
  const qty = Math.max(1, qtyOf(cart, item.id, "marketplace"));

  if (item.stockQty === 0) return null;

  // T-17: a TEXT secondary, not a rival pill. "Add to cart"
  // (MarketplaceAddToCart, gold) is the PDP's one action — pantry rides along
  // with the meal order; this is the alternative for someone buying the pantry
  // item alone.
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Link
        href={checkoutHref({ mode: "marketplace", itemSlug: item.slug, qty })}
        className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Buy on its own
      </Link>
    </div>
  );
}
