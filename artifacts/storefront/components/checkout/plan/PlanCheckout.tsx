"use client";
// Client: drives the live plan-subscription money path end to end.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runCheckout, finishPlanPayment, type PlanOrderRef } from "@/lib/moneyPath";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import { buildSubscriptionInput, nextWeekdayISO } from "@/lib/planCheckout";
import { stashCheckoutPerks, type CheckoutPerks } from "@/lib/postCheckout";
import { usePlanQuote } from "@/lib/usePlanQuote";
import { getAddresses, ApiError, type Address, type AuthUser, type AddOnId, type DietTrack, type PlanCadence } from "@/lib/api";
import { PlanIdentityGate } from "./PlanIdentityGate";
import { PlanDetails, type PlanDetailsValue } from "./PlanDetails";

/**
 * Live plan checkout (SF-07/09/11 · CUJ-02/04). Identity (Firebase → session) →
 * track + eater profile + address → real pay via runCheckout
 * (createSubscription → Razorpay order for its first cycle → modal → verify).
 * The SERVER prices the plan — and any billed add-ons — from planId
 * (subscriptions.ts overrides pricePerDeliveryPaise with the corpus quote +
 * plan-review add-ons); this sends the collected profile + the server's own
 * meals-per-delivery, never a client-authored amount.
 */
export function PlanCheckout({
  planId,
  planName,
  servedTracks,
  initialTrack,
  cadence,
  addOns,
  finePrint,
  successPerks,
}: {
  planId: string;
  planName: string;
  servedTracks: DietTrack[];
  /** Entry-surface track preselect (?track=…), host-validated against servedTracks. */
  initialTrack?: DietTrack;
  /** Billing cadence the builder confirmed (?cycle=…), host-validated. Defaults
   *  to "monthly" — the builder's own default — never invented client-side. */
  cadence?: PlanCadence;
  /** Plan-review add-ons to bill (host-validated against the allow-list) —
   *  threaded through quote AND create so display always equals charge. */
  addOns?: AddOnId[];
  /** Offer terms under the total (spine copy — trial creditback etc.), never a price. */
  finePrint?: string[];
  /** Plan-scoped perks stashed for the confirmation beside the verify facts. */
  successPerks?: CheckoutPerks;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [track, setTrack] = useState<DietTrack>(initialTrack ?? servedTracks[0] ?? "veg");
  const billedCadence = cadence ?? "monthly";
  // Server quote per (plan, track, cadence, add-ons) — the billed total, net of
  // any redeemable credit once signed in; gates the CTA. `cadence` must match
  // what `buildSubscriptionInput` below sends to create, or the displayed quote
  // and the actual charge disagree.
  const { quote, quoteLoading, quoteError, retryQuote } = usePlanQuote(
    planId,
    track,
    addOns,
    user !== null,
    billedCadence,
  );
  const [savedAddress, setSavedAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  // "Opening payment…" vs "Confirming your payment…" — see handlePay's
  // onVerifying. Money is captured the instant the modal resolves; a slow
  // verify retry (moneyPath's verifyWithRetry) must never look like the
  // button silently died.
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The created subscription, so a retry after a dismissed modal resumes payment
  // on it instead of creating a second subscription.
  const createdRef = useRef<PlanOrderRef | null>(null);

  function onVerified(u: AuthUser) {
    setUser(u);
    void getAddresses()
      .then(({ addresses }) => {
        const pick = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (pick) setSavedAddress(pick);
      })
      .catch(() => {});
  }

  async function handlePay(v: PlanDetailsValue) {
    if (!user || !quote) return;
    setError(null);
    setBusy(true);
    const phone = user.phoneE164 ?? "";
    const adapter = createRazorpayAdapter({ name: "Tanmatra", description: `${planName} plan`, contact: phone });
    try {
      let result;
      if (createdRef.current) {
        // A prior attempt already created this subscription — pay it, don't
        // create a second one.
        result = await finishPlanPayment(createdRef.current, adapter, undefined, {
          onVerifying: () => setVerifying(true),
        });
      } else {
        const subscription = buildSubscriptionInput({
          planId,
          track,
          cadence: billedCadence,
          mealsPerDelivery: quote.mealsPerDelivery,
          addOns,
          startDate: nextWeekdayISO(new Date()),
          members: [v.member],
          address: v.address,
          phone,
        });
        result = await runCheckout({
          subscription,
          razorpay: adapter,
          onCreated: (ref) => {
            createdRef.current = ref;
          },
          onVerifying: () => setVerifying(true),
        });
      }
      // Hand the money event's facts to the confirmation screen — the autopay
      // disclaimer verbatim from verify, the plan/subscription for post-purchase
      // attach, plus any host-declared perks (trial creditback).
      stashCheckoutPerks(result.orderId, {
        autopayDisclaimer: result.autopayDisclaimer,
        planId,
        subscriptionId: createdRef.current?.subscriptionId,
        creditAppliedPaise: createdRef.current?.creditAppliedPaise,
        ...successPerks,
      });
      router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
    } catch (e) {
      if (e instanceof RazorpayDismissed) {
        setError("Payment cancelled — you haven't been charged. Tap Continue to try again.");
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      }
      setBusy(false);
      setVerifying(false);
    }
  }

  if (!user) {
    return <PlanIdentityGate planName={planName} onVerified={onVerified} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{planName}</h1>
      <PlanDetails
        servedTracks={servedTracks}
        track={track}
        onTrackChange={setTrack}
        quoteTotalPaise={quote?.payableTotalPaise ?? null}
        quoteLoading={quoteLoading}
        quoteError={quoteError}
        onRetryQuote={retryQuote}
        addOnLine={quote?.addOnLine ?? null}
        creditAppliedPaise={quote?.creditAppliedPaise ?? 0}
        initialAddress={savedAddress}
        finePrint={finePrint}
        busy={busy}
        verifying={verifying}
        error={error}
        onSubmit={handlePay}
      />
    </div>
  );
}
