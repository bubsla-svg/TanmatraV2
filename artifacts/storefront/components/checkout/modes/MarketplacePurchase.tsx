"use client";
// Client island: the pantry money path, now hosted on /checkout like every
// other purchase. "use client" because it owns the cart handoff and the
// Razorpay-driven PurchaseRunner beneath it.
import { useMemo } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { setQty } from "@/lib/cartStore";
import { formatPaise } from "@/lib/format";
import { newIdempotencyKey, type MarketplaceItem } from "@/lib/marketplaceApi";
import { marketplaceSteps } from "@/lib/purchaseSteps";
import { PurchaseRunner } from "../PurchaseRunner";
import { PurchaseSummary } from "./PurchaseSummary";

/**
 * A single pantry item bought on its own. The PDP's "Buy on its own" used to
 * open Razorpay in place; it now links here, so the pantry gets the same
 * summary, the same auth gate and — the part it never had on the PDP — the
 * same captured-but-unverified recovery as a meal order.
 *
 * The idempotency key is minted ONCE per mount and reused across retries: the
 * old call site minted a fresh one per attempt, so a create retried after a
 * dropped connection was a second order, a second stock decrement and a second
 * charge.
 */
export function MarketplacePurchase({ item, qty }: { item: MarketplaceItem; qty: number }) {
  const { cart, setCart } = useCart();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);
  const totalPaise = item.pricePaise * qty;

  const steps = useMemo(
    () => marketplaceSteps(item, qty, idempotencyKey, `Pay ${formatPaise(totalPaise)}`),
    [item, qty, idempotencyKey, totalPaise],
  );

  if (item.stockQty === 0) {
    return (
      <PurchaseSummary title={item.name} lines={[{ label: "Out of stock" }]}>
        <p className="text-sm text-ink-muted">
          This one has sold out. Everything else in the pantry is still available.
        </p>
      </PurchaseSummary>
    );
  }

  return (
    <>
      <PurchaseSummary
        title={item.name}
        lines={[
          { label: `${formatPaise(item.pricePaise)} × ${qty}`, value: formatPaise(totalPaise) },
          ...(item.weightLabel ? [{ label: item.weightLabel }] : []),
        ]}
        note="Shipped on its own — meal deliveries are unaffected."
      />
      <PurchaseRunner
        steps={steps}
        description={item.name}
        amountPaise={totalPaise}
        kind="marketplace"
        // The item is bought, so its carted line must go — otherwise the
        // drawer keeps counting it in the subtotal and invites a second buy of
        // goods already paid for. Passed as a live prop rather than closed
        // over in `steps`, so it always clears against the CURRENT cart.
        onComplete={() => setCart(setQty(cart, item.id, "marketplace", 0))}
        authPrompt="Sign in to place your pantry order."
      />
    </>
  );
}
