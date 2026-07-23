"use client";
// Client: drives the live plan-subscription money path end to end.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { runCheckout } from "@/lib/moneyPath";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import { buildSubscriptionInput, nextWeekdayISO } from "@/lib/planCheckout";
import { quotePlan, getAddresses, ApiError, type Address, type AuthUser, type DietTrack } from "@/lib/api";
import { PhoneAuth } from "../PhoneAuth";
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
}: {
  planId: string;
  planName: string;
  servedTracks: DietTrack[];
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [track, setTrack] = useState<DietTrack>(servedTracks[0] ?? "veg");
  const [quote, setQuote] = useState<{ mealsPerDelivery: number; totalPaise: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [savedAddress, setSavedAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server quote per track — the authoritative meals-per-delivery + billed total
  // (the same corpus quote the create route bills from, so the displayed number
  // matches the charge). No auth needed; runs before and after sign-in.
  useEffect(() => {
    let live = true;
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
    try {
      const result = await runCheckout({
        subscription,
        razorpay: createRazorpayAdapter({ name: "Tanmatra", description: `${planName} plan`, contact: phone }),
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
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-ink">Start your {planName} plan</h1>
        <p className="text-sm text-ink-muted">Sign in to set up delivery — a code by SMS, no passwords.</p>
        <PhoneAuth onVerified={onVerified} />
      </div>
    );
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
        busy={busy}
        error={error}
        onSubmit={handlePay}
      />
    </div>
  );
}
