"use client";
// Client: reads the interactive cart and drives the guest money path end to end.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";
import { itemCount, type CartState } from "@/lib/cartStore";
import {
  runAlacarteCheckout,
  finishAlacartePayment,
  retryVerifyPayment,
  type PaidFacts,
} from "@/lib/moneyPath";
import { fetchQuote, quoteIsFresh, type QuoteSnapshot } from "@/lib/quoteApi";
// lib/orderErrors owns the failure copy (Architecture Invariant 18: what,
// why, and what to do next — never the raw server string) plus the
// retryable/deterministic split that keeps "Retry pricing" honest.
import { humanizeOrderError, isRetryableQuoteError } from "@/lib/orderErrors";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import {
  getAddresses,
  type Address,
  type AlacarteOrderInput,
  type AlacarteOrderResponse,
  type AuthUser,
} from "@/lib/api";
import { DPDP_POLICY_VERSION } from "@/lib/consent";
import { PhoneAuth } from "./PhoneAuth";
import { AlacarteDetails, type AlacarteAddress } from "./AlacarteDetails";
import { UnresolvedPaymentPanel } from "./UnresolvedPaymentPanel";

export type QuoteUiState = "loading" | "active" | "expired" | "error";

/** Back/forward navigation must not eat a typed phone number (sweep: "Back
 *  preserves cart and valid draft state"). Address draft lives with its
 *  fields in AlacarteDetails under its own key. */
const PHONE_DRAFT_KEY = "alc_draft_phone_v1";
export const ADDRESS_DRAFT_KEY = "alc_draft_address_v1";

/**
 * À-la-carte guest checkout (SF-05 / CUJ-01 tail). Cart → details → Razorpay
 * modal → verify → confirmation. The server owns every amount: totals render
 * from the QuoteSnapshot (POST /orders/quote, priced by the same code that
 * bills at POST /orders), and this sends the cart's item ids plus the
 * collected contact/address — never a price. Optional Firebase sign-in (SF-03)
 * attributes the order and prefills the phone, but the path completes fully
 * as a guest.
 */
export function AlacarteCheckout() {
  const router = useRouter();
  const { cart, hydrated } = useCart();
  // This screen only ever creates a DISH order (POST /orders) — marketplace
  // items ship through their own product-page checkout (payForMarketplace).
  // Scoping the summary/total to dish lines keeps the amount shown here
  // identical to the amount actually billed; a marketplace line silently
  // dropped from the order but still counted in the displayed total would be
  // a real money-integrity bug, not a display nit.
  const dishLines = cart.lines.filter((l) => l.kind === "dish");
  const marketplaceLines = cart.lines.filter((l) => l.kind === "marketplace");
  const dishCart: CartState = { lines: dishLines };
  const [phone, setPhone] = useState("");
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  // Money captured, verify in flight (with in-place retry — see moneyPath's
  // verifyWithRetry). Distinct from `busy` so the CTA can say what is
  // actually happening to money that has already left the customer's account.
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SF-04 in-flow: once signed in, a saved default address prefills the form.
  const [savedAddress, setSavedAddress] = useState<Address | null>(null);

  // Server QuoteSnapshot lifecycle (quote-loading → active → expired, or
  // error with retry — the architecture doc's checkout state machine).
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteUiState>("loading");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  // False for deterministic 4xx refusals (safety block, paused dish): the fix
  // is editing the cart, so offering "Retry pricing" there is a loop that
  // cannot converge — the production bug this state exists to prevent.
  const [quoteRetryable, setQuoteRetryable] = useState(true);
  const [pincode, setPincode] = useState("");
  const quoteSeq = useRef(0);

  const loadQuote = useCallback(() => {
    if (dishLines.length === 0) return;
    const seq = ++quoteSeq.current;
    setQuoteState("loading");
    setQuoteError(null);
    const items = dishLines.map((l) => ({
      dishId: l.dishId,
      qty: l.qty,
      ...(l.customizationSelections && l.customizationSelections.length > 0
        ? { customizations: l.customizationSelections }
        : {}),
    }));
    const pin = pincode.replace(/\D/g, "").length === 6 ? pincode.replace(/\D/g, "") : undefined;
    fetchQuote(items, pin)
      .then((q) => {
        if (seq !== quoteSeq.current) return; // a newer cart state superseded this fetch
        setQuote(q);
        setQuoteState("active");
      })
      .catch((e) => {
        if (seq !== quoteSeq.current) return;
        setQuote(null);
        setQuoteState("error");
        setQuoteError(humanizeOrderError(e));
        setQuoteRetryable(isRetryableQuoteError(e));
      });
  }, [dishLines, pincode]);

  // Re-quote when the priced inputs change (debounced — steppers click fast).
  const quoteKey = JSON.stringify(
    dishLines.map((l) => [l.dishId, l.qty, l.customizationSelections ?? null]),
  );
  const pinKey = pincode.replace(/\D/g, "").length === 6 ? pincode.replace(/\D/g, "") : "";
  useEffect(() => {
    if (!hydrated || dishLines.length === 0) return;
    const t = setTimeout(loadQuote, 350);
    return () => clearTimeout(t);
    // quoteKey/pinKey are the serialized deps loadQuote actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, quoteKey, pinKey]);

  // Flip the display to quote-expired when the advisory window closes —
  // stale prices must ask to be refreshed, not keep quietly rendering.
  useEffect(() => {
    if (!quote || quoteState !== "active") return;
    const ms = Date.parse(quote.expiresAt) - Date.now();
    if (!Number.isFinite(ms)) return;
    if (ms <= 0) {
      setQuoteState("expired");
      return;
    }
    const t = setTimeout(() => {
      setQuoteState((s) => (s === "active" && !quoteIsFresh(quote) ? "expired" : s));
    }, ms + 250);
    return () => clearTimeout(t);
  }, [quote, quoteState]);

  // Draft persistence: survive back/forward without re-typing.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PHONE_DRAFT_KEY);
      if (saved) setPhone((p) => (p === "" ? saved : p));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (phone) sessionStorage.setItem(PHONE_DRAFT_KEY, phone);
    } catch {}
  }, [phone]);

  // One idempotency key per checkout session, and the order once created, so a
  // retry after a dismissed modal resumes payment instead of creating a
  // duplicate (the server 409s a reused externalOrderId).
  const idempotencyKey = useRef<string | null>(null);
  const createdOrder = useRef<AlacarteOrderResponse | null>(null);
  // Set the instant Razorpay captures money; see PlanCheckout.tsx's identical
  // field for the full rationale — once set, a failure must never re-enable a
  // CTA that would call createRazorpayOrder (and reopen the modal) again.
  const paidFactsRef = useRef<PaidFacts | null>(null);
  const [unresolved, setUnresolved] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  function onVerified(user: AuthUser) {
    if (user.phoneE164) {
      setPhone(user.phoneE164.replace(/^\+?91/, ""));
      setPhoneLocked(true);
    }
    // Prefill from the saved default address, if any (SF-04). Best-effort: a
    // failure just leaves the manual form — the guest path never depends on it.
    void getAddresses()
      .then(({ addresses }) => {
        const pick = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (pick) setSavedAddress(pick);
      })
      .catch(() => {});
  }

  async function handlePay(address: AlacarteAddress, allergenAck?: boolean) {
    if (dishLines.length === 0) return; // defense-in-depth; the button is also gated
    setError(null);
    setBusy(true);
    const contact = `+91${phone.replace(/\D/g, "")}`;
    try {
      let result;
      if (createdOrder.current) {
        // A prior attempt already created this order — pay it, don't re-create.
        result = await finishAlacartePayment(createdOrder.current, createRazorpayAdapter({ contact }), undefined, {
          onVerifying: () => setVerifying(true),
          onCaptured: (facts) => {
            paidFactsRef.current = facts;
          },
        });
      } else {
        if (!idempotencyKey.current) idempotencyKey.current = `alc-${crypto.randomUUID()}`;
        const order: AlacarteOrderInput = {
          externalOrderId: idempotencyKey.current,
          items: dishLines
            .map((l) => ({
              dishId: l.dishId,
              qty: l.qty,
              ...(l.customizationSelections && l.customizationSelections.length > 0
                ? { customizations: l.customizationSelections }
                : {}),
            })),
          phone: contact,
          address,
          consent: { accepted: true, policyVersion: DPDP_POLICY_VERSION },
          // Omit entirely rather than send `false`: the server only cares
          // whether an explicit acknowledgement was made (assessAllergenAck
          // treats a missing key and `false` identically), and omitting keeps
          // the wire payload honest about "not asked" vs "asked, declined".
          ...(allergenAck ? { allergenAck: true } : {}),
        };
        result = await runAlacarteCheckout({
          order,
          razorpay: createRazorpayAdapter({ contact }),
          onCreated: (o) => {
            createdOrder.current = o;
          },
          onVerifying: () => setVerifying(true),
          onCaptured: (facts) => {
            paidFactsRef.current = facts;
          },
        });
      }
      try {
        sessionStorage.removeItem(PHONE_DRAFT_KEY);
        sessionStorage.removeItem(ADDRESS_DRAFT_KEY);
      } catch {}
      router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
    } catch (e) {
      if (paidFactsRef.current) {
        // Money is captured and verify still failed after moneyPath's bounded
        // in-flow retries — see PlanCheckout.tsx's identical branch. Never
        // re-enable a CTA that would call createRazorpayOrder again here.
        setUnresolved(true);
        setBusy(false);
        setVerifying(false);
        return;
      }
      if (e instanceof RazorpayDismissed) {
        setError("Payment cancelled — you haven't been charged. Tap Continue to try again.");
      } else {
        setError(humanizeOrderError(e));
      }
      setBusy(false);
      setVerifying(false);
    }
  }

  async function handleCheckStatus() {
    if (!paidFactsRef.current) return; // defense-in-depth; the panel only renders when set
    setCheckingStatus(true);
    try {
      const result = await retryVerifyPayment(paidFactsRef.current);
      router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
    } catch {
      // Still unresolved — verify is safe to ask again, so stay on the panel
      // rather than surfacing a dead-end error.
      setCheckingStatus(false);
    }
  }

  if (unresolved) {
    return <UnresolvedPaymentPanel checking={checkingStatus} onCheckStatus={() => void handleCheckStatus()} />;
  }

  if (hydrated && itemCount(cart) === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h2 className="text-xl font-semibold text-ink">Your cart is empty</h2>
        <p className="text-sm text-ink-muted">Add a dish or a pantry item and it&rsquo;ll show up here to check out.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild shape="pill" size="fluid" className="px-6 py-3 font-semibold">
            <Link href="/menu">Browse meals</Link>
          </Button>
          <Button asChild variant="outline" shape="pill" size="fluid" className="bg-surface px-6 py-3 font-semibold">
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (hydrated && dishLines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h2 className="text-xl font-semibold text-ink">Your cart only has pantry items</h2>
        <p className="text-sm text-ink-muted">
          Pantry &amp; marketplace items ship separately from meals and aren&rsquo;t part of this checkout — buy them from their own product page.
        </p>
        <Button asChild shape="pill" size="fluid" className="px-6 py-3 font-semibold">
          <Link href="/marketplace">Go to marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PhoneAuth onVerified={onVerified} />
      {marketplaceLines.length > 0 && (
        <p role="status" className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-xs text-ink-muted">
          {marketplaceLines.length} pantry {marketplaceLines.length === 1 ? "item" : "items"} in your cart {marketplaceLines.length === 1 ? "isn't" : "aren't"} included in this order — buy {marketplaceLines.length === 1 ? "it" : "them"} separately from the <Link href="/marketplace" className="font-medium text-gold-text hover:underline">marketplace</Link>.
        </p>
      )}
      <AlacarteDetails
        cart={dishCart}
        phone={phone}
        onPhoneChange={setPhone}
        phoneLocked={phoneLocked}
        initialAddress={savedAddress}
        busy={busy}
        verifying={verifying}
        error={error}
        onSubmit={handlePay}
        quote={quote}
        quoteState={quoteState}
        quoteError={quoteError}
        quoteRetryable={quoteRetryable}
        onRefreshQuote={loadQuote}
        onPincodeChange={setPincode}
      />
    </div>
  );
}
