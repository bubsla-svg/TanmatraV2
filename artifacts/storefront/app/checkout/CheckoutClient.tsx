"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadCart, type CartLine } from "../../lib/cartStore";

// The server's quote snapshot type
type QuoteSnapshot = {
  id: string;
  status: "active" | "expired" | "superseded";
  createdAt: string;
  expiresAt: string;
  currency: "INR";
  totalPaise: number;
  version: number;
  items: Array<{
    id: number;
    name: string;
    qty: number;
    price: number;
  }>;
};

type QuoteDifference = {
  totalDeltaPaise: number;
  itemChanges: Array<{
    lineId: string;
    label: string;
    previousAmountPaise: number;
    currentAmountPaise: number;
    deltaPaise: number;
    reason: "price_changed" | "configuration_changed" | "item_unavailable" | "entitlement_changed";
  }>;
};

type PaymentAttempt = {
  id: string;
  status: "created" | "processing" | "requires_action" | "succeeded" | "failed" | "unresolved";
  orderId?: string;
};

type StateMachine =
  | { state: "loading_quote" }
  | { state: "quote_active"; quote: QuoteSnapshot }
  | { state: "payment_creating"; quote: QuoteSnapshot }
  | { state: "payment_processing"; quote: QuoteSnapshot }
  | { state: "payment_unresolved"; quote: QuoteSnapshot }
  | { state: "payment_succeeded"; quote: QuoteSnapshot; orderId: string }
  | { state: "payment_failed"; quote: QuoteSnapshot; error: string }
  | { state: "quote_expired"; quote: QuoteSnapshot }
  | { state: "quote_refreshing"; quote: QuoteSnapshot }
  | { state: "quote_changed"; quote: QuoteSnapshot; diff: QuoteDifference }
  | { state: "status_rechecking"; quote: QuoteSnapshot };

export default function CheckoutClient() {
  const router = useRouter();
  const [machine, setMachine] = useState<StateMachine>({ state: "loading_quote" });
  const [idempotencyKey] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("checkout_idempotency_key");
      if (stored) return stored;
      const newKey = crypto.randomUUID();
      sessionStorage.setItem("checkout_idempotency_key", newKey);
      return newKey;
    }
    return "";
  });

  // Countdown timer for display
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    // Generate initial quote or restore state
    async function initQuote() {
      const cart = loadCart();
      if (cart.lines.length === 0) {
        // empty cart logic here
        return;
      }

      // Try to restore from sessionStorage
      if (typeof window !== "undefined") {
        const storedQuoteStr = sessionStorage.getItem("checkout_quote");
        const storedKey = sessionStorage.getItem("checkout_idempotency_key");

        if (storedQuoteStr && storedKey) {
          try {
            const storedQuote: QuoteSnapshot = JSON.parse(storedQuoteStr);
            
            // Basic cart match check
            const cartItems = cart.lines.map((i: CartLine) => ({ id: i.dishId, qty: i.qty }));
            const quoteItems = storedQuote.items.map(i => ({ id: i.id, qty: i.qty }));
            cartItems.sort((a, b) => a.id - b.id);
            quoteItems.sort((a, b) => a.id - b.id);
            
            const matches = cartItems.length === quoteItems.length &&
              cartItems.every((item, idx) => {
                const qItem = quoteItems[idx];
                return qItem && item.id === qItem.id && item.qty === qItem.qty;
              });

            if (matches) {
              // Check backend status
              const res = await fetch(`/api/payment-attempts/by-idempotency-key/${storedKey}`);
              if (res.ok) {
                const attempt: PaymentAttempt = await res.json();
                if (attempt.status === "succeeded" && attempt.orderId) {
                  setMachine({ state: "payment_succeeded", quote: storedQuote, orderId: attempt.orderId });
                  return;
                } else if (attempt.status === "processing") {
                  setMachine({ state: "payment_unresolved", quote: storedQuote });
                  return;
                } else if (attempt.status === "failed") {
                  setMachine({ state: "payment_failed", quote: storedQuote, error: "Payment failed" });
                  return;
                }
              }
              // If no attempt found or error, but quote is valid, use it
              if (new Date(storedQuote.expiresAt).getTime() > Date.now()) {
                setMachine({ state: "quote_active", quote: storedQuote });
                return;
              }
            }
          } catch (e) {
            console.error("Failed to restore checkout state", e);
          }
        }
      }

      // Fallback: Create new quote
      try {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.lines.map((i: CartLine) => ({ dishId: i.dishId, qty: i.qty }))
          })
        });
        if (!res.ok) throw new Error("Failed to create quote");
        const quote: QuoteSnapshot = await res.json();
        setMachine({ state: "quote_active", quote });
      } catch (err) {
        console.error(err);
      }
    }
    initQuote();
  }, []);

  // Persist quote to sessionStorage
  useEffect(() => {
    if (machine && "quote" in machine && machine.quote) {
      sessionStorage.setItem("checkout_quote", JSON.stringify(machine.quote));
    }
  }, [machine]);

  useEffect(() => {
    if (machine.state !== "quote_active") {
      setTimeLeft(null);
      return;
    }
    const updateCountdown = () => {
      const now = Date.now();
      const expiresAt = new Date(machine.quote.expiresAt).getTime();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setTimeLeft(0);
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [machine]);

  const handlePay = async () => {
    if (!("quote" in machine)) return;
    const { quote } = machine;
    setMachine({ state: "payment_creating", quote });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch("/api/payment-attempts", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({ quoteId: quote.id })
      });
      clearTimeout(timer);

      if (res.status === 409) {
        const data = await res.json();
        if (data.code === "quote_expired" || data.code === "quote_superseded") {
          setMachine({ state: "quote_expired", quote });
          return;
        }
        if (data.code === "ORDER_ALREADY_CONFIRMED") {
          setMachine({ state: "payment_succeeded", quote, orderId: data.orderId });
          return;
        }
        if (data.code === "PAYMENT_ATTEMPT_ALREADY_EXISTS") {
          // If we already have a processing attempt, we go to unresolved to wait or check
          setMachine({ state: "payment_unresolved", quote });
          return;
        }
      }

      if (!res.ok) throw new Error("Payment failed");

      // Simulating processing state
      setMachine({ state: "payment_processing", quote });

      // Automatically succeed after a bit for demo purposes
      setTimeout(() => {
        setMachine({ state: "payment_succeeded", quote, orderId: crypto.randomUUID() });
      }, 2000);

    } catch (err: any) {
      if (err.name === "AbortError") {
        setMachine({ state: "payment_unresolved", quote });
      } else {
        setMachine({ state: "payment_failed", quote, error: err.message });
      }
    }
  };

  const handleRefreshQuote = async () => {
    if (!("quote" in machine)) return;
    const { quote } = machine;
    setMachine({ state: "quote_refreshing", quote });

    try {
      const res = await fetch(`/api/quotes/${quote.id}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      const data = await res.json();

      if (data.requiresAcceptance) {
        setMachine({ state: "quote_changed", quote: data.quote, diff: data.difference });
      } else {
        setMachine({ state: "quote_active", quote: data.quote });
      }
    } catch (err) {
      console.error(err);
      setMachine({ state: "quote_expired", quote }); // Fall back
    }
  };

  const handleAcceptQuote = () => {
    if (machine.state !== "quote_changed") return;
    setMachine({ state: "quote_active", quote: machine.quote });
  };

  const handleRecheckStatus = async () => {
    if (!("quote" in machine)) return;
    const { quote } = machine;
    setMachine({ state: "status_rechecking", quote });

    try {
      const res = await fetch(`/api/payment-attempts/by-idempotency-key/${idempotencyKey}`);
      if (!res.ok) throw new Error("Check failed");
      const attempt: PaymentAttempt = await res.json();

      if (attempt.status === "succeeded" && attempt.orderId) {
        setMachine({ state: "payment_succeeded", quote, orderId: attempt.orderId });
      } else if (attempt.status === "processing") {
        setMachine({ state: "payment_unresolved", quote });
      } else if (attempt.status === "failed") {
        setMachine({ state: "payment_failed", quote, error: "Payment failed" });
      } else {
        setMachine({ state: "payment_unresolved", quote });
      }
    } catch (err) {
      setMachine({ state: "payment_unresolved", quote });
    }
  };

  if (machine.state === "loading_quote") {
    return (
      <div className="bg-surface text-on-surface min-h-[max(884px,100dvh)] flex items-center justify-center">
        <p>Loading quote...</p>
      </div>
    );
  }

  const { quote } = machine as { quote: QuoteSnapshot };

  return (
    <div className="bg-surface text-on-surface min-h-[max(884px,100dvh)] font-body-lg text-body-lg overflow-x-hidden selection:bg-primary/30">
      <header className="fixed top-0 w-full z-50 bg-glass backdrop-blur-md border-b border-hairline">
        <div className="flex items-center px-gutter h-16 max-w-[1280px] mx-auto">
          <Link href="/menu" className="flex items-center gap-2 group mr-4">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </div>
            <span className="font-label-caps text-xs tracking-widest uppercase font-bold hidden sm:block">Back</span>
          </Link>
          <div className="flex-1 flex justify-center">
            <h1 className="font-headline-md font-semibold tracking-tight text-xl">Checkout</h1>
          </div>
          <div className="w-8 mr-4 sm:mr-[52px]" />
        </div>
      </header>

      <main className="pt-24 pb-32 px-gutter max-w-[1280px] mx-auto min-h-screen">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {/* Order Summary */}
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-surface-container rounded-3xl p-6 lg:p-8 border border-hairline space-y-6">
              <h2 className="font-headline-md font-semibold text-xl tracking-tight">Order Summary</h2>

              {machine.state === "quote_changed" && machine.diff && (
                <div className="bg-surface border border-hairline p-4 rounded-xl">
                  <h3 className="text-error font-bold mb-2">Quote Updated</h3>
                  <p>Your total changed by ₹{machine.diff.totalDeltaPaise / 100}</p>
                  <ul className="list-disc pl-5 mt-2">
                    {machine.diff.itemChanges.map(change => (
                      <li key={change.lineId}>{change.label}: ₹{change.previousAmountPaise/100} {"->"} ₹{change.currentAmountPaise/100} ({change.reason})</li>
                    ))}
                  </ul>
                  <button onClick={handleAcceptQuote} className="mt-4 bg-primary text-on-primary px-4 py-2 rounded-xl">
                    Accept Changes
                  </button>
                </div>
              )}

              {machine.state === "payment_failed" && (
                <div className="bg-error/10 border border-error/20 p-4 rounded-xl">
                  <h3 className="text-error font-bold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">error</span>
                    Payment Failed
                  </h3>
                  <p className="text-sm">Your payment attempt was not successful. Please retry with a new payment method or key.</p>
                </div>
              )}

              {machine.state === "quote_expired" && (
                <div className="bg-error/10 border border-error/20 p-4 rounded-xl">
                  <h3 className="text-error font-bold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">timer_off</span>
                    Quote Expired
                  </h3>
                  <p className="text-sm">Your quote has expired. Please refresh to continue.</p>
                  <button onClick={handleRefreshQuote} className="mt-4 bg-primary text-on-primary px-4 py-2 rounded-xl">
                    Refresh Quote
                  </button>
                </div>
              )}

              {machine.state === "payment_unresolved" && (
                <div className="bg-surface border border-hairline p-4 rounded-xl">
                  <h3 className="text-primary font-bold mb-2">Payment Processing Unresolved</h3>
                  <p className="text-sm">Your payment attempt timed out or is still processing. <strong>Do not pay again.</strong></p>
                  <button onClick={handleRecheckStatus} className="mt-4 bg-primary text-on-primary px-4 py-2 rounded-xl">
                    Recheck Status
                  </button>
                </div>
              )}

              {machine.state === "payment_succeeded" && (
                <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                  <h3 className="text-primary font-bold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined">check_circle</span>
                    Payment Succeeded
                  </h3>
                  <p className="text-sm">Your order {machine.orderId && `(${machine.orderId})`} is confirmed.</p>
                  <Link href={`/order/confirmed/${machine.orderId}`} className="mt-4 inline-block bg-primary text-on-primary px-4 py-2 rounded-xl">
                    View Order
                  </Link>
                </div>
              )}

              <div className="space-y-4">
                {quote.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-surface border border-hairline">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-body-lg font-medium">{item.name}</h3>
                        <span className="font-clinical-data font-semibold">₹{item.price / 100}</span>
                      </div>
                      <div className="text-sm opacity-60">Qty: {item.qty}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Payment */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-surface-container rounded-3xl p-6 lg:p-8 border border-hairline sticky top-24 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>Total Payable</span>
                  <span className="font-clinical-data tracking-tight">₹{quote.totalPaise / 100}</span>
                </div>

                {machine.state === "quote_active" && timeLeft !== null && (
                  <div className="text-sm text-center">
                    Quote expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>

              <button
                onClick={handlePay}
                disabled={machine.state !== "quote_active"}
                className="w-full bg-primary text-on-primary h-14 rounded-full font-label-caps text-sm font-bold tracking-widest uppercase transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {machine.state === "payment_creating" || machine.state === "payment_processing" ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    Processing...
                  </>
                ) : (
                  `Pay ₹${quote.totalPaise / 100}`
                )}
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
