"use client";
// Client: drives the live plan-subscription money path end to end.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runCheckout, finishPlanPayment, type PlanOrderRef } from "@/lib/moneyPath";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import { buildSubscriptionInput, nextWeekdayISO } from "@/lib/planCheckout";
import { stashCheckoutPerks, type CheckoutPerks } from "@/lib/postCheckout";
import { quotePlan, getAddresses, ApiError, type Address, type AuthUser, type DietTrack } from "@/lib/api";
import { PlanIdentityGate } from "./PlanIdentityGate";
import { PlanDetails, type PlanDetailsValue } from "./PlanDetails";

/**
 * Live plan checkout (SF-07 / CUJ-02). Identity (Firebase → session) → track +
 * eater profile + address → real pay via runCheckout (createSubscription →
 * Razorpay order for its first cycle → modal → verify). The SERVER prices the
 * plan from planId (subscriptions.ts overrides pricePerDeliveryPaise with the
 * corpus quote); this sends the collected profile + the server's own
 * meals-per-delivery, never a client-authored amount.
 */
export function PlanCheckout({
  planId,
  planName,
  servedTracks,
  initialTrack,
  finePrint,
  successPerks,
}: {
  planId: string;
  planName: string;
  servedTracks: DietTrack[];
  /** Entry-surface track preselect (?track=…), host-validated against servedTracks. */
  initialTrack?: DietTrack;
  /** Offer terms under the total (spine copy — trial creditback etc.), never a price. */
  finePrint?: string[];
  /** Plan-scoped perks stashed for the confirmation beside the verify facts. */
  successPerks?: CheckoutPerks;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [track, setTrack] = useState<DietTrack>(initialTrack ?? servedTracks[0] ?? "veg");
  const [quote, setQuote] = useState<{ mealsPerDelivery: number; totalPaise: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [savedAddress, setSavedAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The created subscription, so a retry after a dismissed modal resumes payment
  // on it instead of creating a second subscription.
  const createdRef = useRef<PlanOrderRef | null>(null);

  // Server quote per track — the authoritative meals-per-delivery + billed total
  // (the same corpus quote the create route bills from, so the displayed number
  // matches the charge). No auth needed; runs before and after sign-in. Clearing
  // `quote` on track change gates the CTA until the fresh quote lands, so a
  // submit can never pair the new track with the old track's meals-per-delivery.
  useEffect(() => {
    let live = true;
    setQuote(null);
    setQuoteLoading(true);
    quotePlan({ planId, track, cadence: "monthly" })
      .then((q) => { if (live) setQuote({ mealsPerDelivery: q.mealsPerDelivery, totalPaise: q.totalPaise }); })
      .catch(() => { if (live) setQuote(null); })
      .finally(() => { if (live) setQuoteLoading(false); });
    return () => { live = false; };
  }, [planId, track]);

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
        result = await finishPlanPayment(createdRef.current, adapter);
      } else {
        const subscription = buildSubscriptionInput({
          planId,
          track,
          cadence: "monthly",
          mealsPerDelivery: quote.mealsPerDelivery,
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
        });
      }
      // Hand the money event's facts to the confirmation screen — the autopay
      // disclaimer verbatim from verify, plus any plan-scoped perks the host
      // declared (trial creditback).
      stashCheckoutPerks(result.orderId, {
        autopayDisclaimer: result.autopayDisclaimer,
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
    }
  }

  if (!user) {
    return <PlanIdentityGate planName={planName} onVerified={onVerified} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold text-ink">{planName}</h1>
      <PlanDetails
        servedTracks={servedTracks}
        track={track}
        onTrackChange={setTrack}
        quoteTotalPaise={quote?.totalPaise ?? null}
        quoteLoading={quoteLoading}
        initialAddress={savedAddress}
        finePrint={finePrint}
        busy={busy}
        error={error}
        onSubmit={handlePay}
      />
    </div>
  );
}
