"use client";
// DEF-RECON-MARKETPLACE-001: payForMarketplace() + POST /marketplace/checkout
// were complete and tested but had zero callers — AlacarteCheckout.tsx's own
// comment records the intent ("marketplace items ship through their own
// product-page checkout"), so this wires that real money path onto the PDP
// itself, next to the existing cart-only MarketplaceAddToCart. Buys the same
// quantity already reflected in the cart's stepper for this item (1 if not
// yet added), so the two controls never disagree on how many the customer means.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { qtyOf, setQty } from "@/lib/cartStore";
import { useCart } from "@/components/cart/CartProvider";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import { retryVerifyPayment, type PaidFacts } from "@/lib/moneyPath";
import {
  payForMarketplace,
  finishMarketplacePayment,
  type MarketplaceItem,
  type MarketplaceOrder,
} from "@/lib/marketplaceApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { UnresolvedPaymentPanel } from "@/components/checkout/UnresolvedPaymentPanel";

function humanizeBuyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 422) return e.message;
    return e.message;
  }
  return "Payment didn't complete — you can try again.";
}

export function MarketplaceBuyNow({ item }: { item: MarketplaceItem }) {
  const { cart, setCart } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  // A prior attempt's created order — a retry RESUMES payment on it rather
  // than re-running checkout, which would mint a fresh idempotency key and
  // with it a second order, stock decrement and charge.
  const createdRef = useRef<MarketplaceOrder | null>(null);
  // Money captured, verify unconfirmed — the only safe retry from here is the
  // idempotent verify endpoint (UnresolvedPaymentPanel), never a new payment.
  const paidFactsRef = useRef<PaidFacts | null>(null);
  const qty = Math.max(1, qtyOf(cart, item.id, "marketplace"));

  function finishConfirmed(order: MarketplaceOrder) {
    // The purchase is complete — the carted line for this item is now bought,
    // so it must leave the cart. Leaving it kept inflating the drawer's
    // subtotal and invited a second buy of goods already paid for.
    setCart(setQty(cart, item.id, "marketplace", 0));
    router.push(`/order/confirmed/${encodeURIComponent(order.externalOrderId)}`);
  }

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const adapter = createRazorpayAdapter({ name: "Tanmatra", description: item.name });
      const onCaptured = (facts: PaidFacts) => {
        paidFactsRef.current = facts;
      };
      const order = createdRef.current
        ? await finishMarketplacePayment(createdRef.current, adapter, { onCaptured })
        : await payForMarketplace([{ itemId: item.id, qty }], adapter, {
            onCreated: (o) => {
              createdRef.current = o;
            },
            onCaptured,
          });
      finishConfirmed(order);
    } catch (e) {
      if (paidFactsRef.current) {
        // Captured but unverified even after the bounded retries — re-enabling
        // Buy now would open a second real charge. Same terminal state and
        // recovery as the meal checkouts.
        setUnresolved(true);
        setBusy(false);
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        setNeedsAuth(true);
      } else if (e instanceof RazorpayDismissed) {
        setError("Payment cancelled — you haven't been charged. Tap Buy now to try again.");
      } else {
        setError(humanizeBuyError(e));
      }
      setBusy(false);
    }
  }

  async function handleCheckStatus() {
    if (!paidFactsRef.current) return;
    setCheckingStatus(true);
    try {
      const result = await retryVerifyPayment(paidFactsRef.current);
      if (createdRef.current) finishConfirmed(createdRef.current);
      else router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
    } catch {
      // Still unresolved — verify is idempotent and safe to re-ask.
      setCheckingStatus(false);
    }
  }

  if (unresolved) {
    return <UnresolvedPaymentPanel checking={checkingStatus} onCheckStatus={() => void handleCheckStatus()} />;
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
        aria-busy={busy}
        aria-live="polite"
        className="min-h-11 rounded-full border border-line-strong bg-surface px-6 py-2 text-sm font-bold tracking-tight text-ink transition-transform hover:bg-surface-raised active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Opening payment…" : "Buy now"}
      </button>
    </div>
  );
}
