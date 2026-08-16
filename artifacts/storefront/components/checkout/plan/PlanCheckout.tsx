"use client";
// Client: drives the live plan-subscription money path end to end.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  runCheckout,
  finishPlanPayment,
  retryVerifyPayment,
  type PlanOrderRef,
  type PaidFacts,
} from "@/lib/moneyPath";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import { buildSubscriptionInput, nextWeekdayISO } from "@/lib/planCheckout";
import { stashCheckoutPerks, type CheckoutPerks } from "@/lib/postCheckout";
import { usePlanQuote } from "@/lib/usePlanQuote";
import { getAddresses, type Address, type AuthUser, type AddOnId, type DietTrack, type PlanCadence } from "@/lib/api";
import { humanizeOrderError } from "@/lib/orderErrors";
import { PlanIdentityGate } from "./PlanIdentityGate";
import { PlanServiceabilityGate } from "./PlanServiceabilityGate";
import { PlanDetails, type PlanDetailsValue } from "./PlanDetails";
import { UnresolvedPaymentPanel } from "../UnresolvedPaymentPanel";

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
  recap,
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
  /** N5.11 — spine list quote for the sign-in gate's offer recap (host-computed
   *  server-side from computePlanQuote; never authored here). */
  recap?: { mealsPerCycle: number; cycleTotalPaise: number; cadence: string };
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
  // Laws 1 + 7: the PIN is answered before any personal field. Null means the
  // gate has not cleared yet — nothing that asks for identity, allergies or
  // medical conditions may render while it is null.
  const [servicePincode, setServicePincode] = useState<string | null>(null);
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
  // Set the instant Razorpay captures money (moneyPath's onCaptured), cleared
  // only on a successful outcome. Its presence means "money may already be
  // charged" — once set, a failure must never re-enable a CTA that would call
  // createRazorpayOrder again; see handleCheckStatus.
  const paidFactsRef = useRef<PaidFacts | null>(null);
  // One key for the whole checkout attempt (NOT per press): the server replays
  // the original create for a repeat of the same key, so a network retry
  // resumes one subscription instead of minting a second one with its own
  // order, deliveries and credit debit.
  const createKeyRef = useRef<string | null>(null);
  // True once verifyWithRetry's bounded in-flow retries are exhausted for a
  // captured payment. Distinct from `error`: an unresolved payment replaces
  // the whole form with UnresolvedPaymentPanel, it doesn't just show a message
  // next to a CTA that's still safe to press.
  const [unresolved, setUnresolved] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  function onVerified(u: AuthUser) {
    setUser(u);
    void getAddresses()
      .then(({ addresses }) => {
        const pick = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (pick) setSavedAddress(pick);
      })
      .catch(() => {});
  }

  // Hand the money event's facts to the confirmation screen — the autopay
  // disclaimer verbatim from verify, the plan/subscription for post-purchase
  // attach, plus any host-declared perks (trial creditback) — then navigate.
  // Shared by the normal pay flow and handleCheckStatus's success path so
  // both land on the identical confirmation contract.
  function goToConfirmation(result: { orderId: string; autopayDisclaimer?: string }) {
    stashCheckoutPerks(result.orderId, {
      autopayDisclaimer: result.autopayDisclaimer,
      planId,
      subscriptionId: createdRef.current?.subscriptionId,
      creditAppliedPaise: createdRef.current?.creditAppliedPaise,
      ...successPerks,
    });
    router.push(`/order/confirmed/${encodeURIComponent(result.orderId)}`);
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
          onCaptured: (facts) => {
            paidFactsRef.current = facts;
          },
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
        if (!createKeyRef.current) createKeyRef.current = `sub-${crypto.randomUUID()}`;
        result = await runCheckout({
          subscription,
          razorpay: adapter,
          idempotencyKey: createKeyRef.current,
          onCreated: (ref) => {
            createdRef.current = ref;
          },
          onVerifying: () => setVerifying(true),
          onCaptured: (facts) => {
            paidFactsRef.current = facts;
          },
        });
      }
      goToConfirmation(result);
    } catch (e) {
      if (paidFactsRef.current) {
        // Money is captured (onCaptured already fired) and verify still
        // failed even after moneyPath's bounded in-flow retries. Re-enabling
        // the normal CTA here would call createRazorpayOrder again and risk
        // a second charge — show the dedicated recovery panel instead, which
        // only ever re-asks the idempotent verify endpoint.
        setUnresolved(true);
        setBusy(false);
        setVerifying(false);
        return;
      }
      if (e instanceof RazorpayDismissed) {
        setError("Payment cancelled — you haven't been charged. Tap Continue to try again.");
      } else {
        // Through the humanizer, exactly as AlacarteCheckout does. This branch
        // used to render `e.message` raw, so a plan/trial payment failure —
        // the highest-stakes screen in the funnel — showed the server's own
        // string with no next action, while the identical failure on the
        // à-la-carte path got real copy. Same money moment, two different
        // answers, and the worse one on the more expensive purchase.
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
      goToConfirmation(result);
    } catch {
      // Still unresolved — verify is safe to ask again, so stay on the panel
      // rather than surfacing a dead-end error. Never touch paidFactsRef or
      // fall back to the normal form: that would risk reopening the modal.
      setCheckingStatus(false);
    }
  }

  // Serviceability first — ahead of the identity gate, not after it. This
  // ordering IS the fix: the gate below asks for a phone number, and the step
  // after it asks for allergies and medical conditions, so anything that runs
  // before this line collects personal data from someone we may not be able to
  // deliver to at all.
  if (servicePincode === null) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{planName}</h1>
        <PlanServiceabilityGate onServiceable={setServicePincode} />
      </div>
    );
  }

  if (!user) {
    return <PlanIdentityGate planName={planName} recap={recap} onVerified={onVerified} />;
  }

  if (unresolved) {
    return <UnresolvedPaymentPanel checking={checkingStatus} onCheckStatus={() => void handleCheckStatus()} />;
  }

  return (
    <div className="flex flex-col gap-5" data-ui-generation={verifying ? "stitch-74" : undefined} data-screen-id={verifying ? "14.6" : undefined} data-screen-state={verifying ? "payment-processing" : undefined} data-testid={verifying ? "checkout-payment-processing" : undefined}>
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
        // Law 4 (never ask twice): the PIN cleared by the gate above seeds the
        // address step, so the same six digits are not requested a second
        // time. A saved address still wins — it is the more complete answer.
        initialAddress={savedAddress ?? { line1: "", city: "", pincode: servicePincode }}
        finePrint={finePrint}
        busy={busy}
        verifying={verifying}
        error={error}
        onSubmit={handlePay}
      />
    </div>
  );
}
