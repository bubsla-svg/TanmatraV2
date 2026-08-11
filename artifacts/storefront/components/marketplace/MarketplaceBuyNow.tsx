"use client";
// DEF-RECON-MARKETPLACE-001: payForMarketplace() + POST /marketplace/checkout
// were complete and tested but had zero callers — AlacarteCheckout.tsx's own
// comment records the intent ("marketplace items ship through their own
// product-page checkout"), so this wires that real money path onto the PDP
// itself, next to the existing cart-only MarketplaceAddToCart. Buys the same
// quantity already reflected in the cart's stepper for this item (1 if not
// yet added), so the two controls never disagree on how many the customer means.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { qtyOf } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { createRazorpayAdapter } from "@/lib/razorpayAdapter";
import { payForMarketplace, type MarketplaceItem } from "@/lib/marketplaceApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

function humanizeBuyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 422) return e.message;
    return e.message;
  }
  return "Payment didn't complete — you can try again.";
}

export function MarketplaceBuyNow({ item }: { item: MarketplaceItem }) {
  const { cart } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qty = Math.max(1, qtyOf(cart, item.id, "marketplace"));

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const order = await payForMarketplace([{ itemId: item.id, qty }], createRazorpayAdapter());
      router.push(`/order/confirmed/${encodeURIComponent(order.externalOrderId)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setNeedsAuth(true);
      } else {
        setError(humanizeBuyError(e));
      }
      setBusy(false);
    }
  }

  if (item.stockQty === 0) return null;

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-muted">Sign in to place your order.</p>
        <PhoneAuth
          startExpanded
          onVerified={() => {
            setNeedsAuth(false);
            void buy();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void buy()}
        disabled={busy}
        className="min-h-11 rounded-full border border-line-strong bg-surface px-6 py-2 text-sm font-bold tracking-tight text-ink transition-transform hover:bg-surface-raised active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Opening payment…" : "Buy now"}
      </button>
    </div>
  );
}
