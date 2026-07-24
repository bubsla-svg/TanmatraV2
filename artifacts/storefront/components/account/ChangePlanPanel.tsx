"use client";
// Client: change-plan form + Razorpay OTP reauth leg (Wave-2 straggler).
// Cadence/mealsPerDelivery only, and NEVER applied mid-cycle — a request
// only sets pending* fields (see subscriptionsApi.Subscription); it takes
// effect at the next generate-next cycle rollover. A price INCREASE against
// a live autopay mandate needs a fresh Razorpay OTP authorisation first —
// this panel walks both legs, mirroring moneyPath.ts's order→modal→verify.
import { useState } from "react";
import { computeDeliveryPricePaise, type SubscriptionCadence } from "@workspace/subscription-rules";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import {
  changePlan,
  createChangePlanReauthOrder,
  confirmChangePlanReauth,
  type Subscription,
} from "@/lib/subscriptionsApi";

const CADENCES: { id: SubscriptionCadence; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "fortnightly", label: "Fortnightly" },
  { id: "monthly", label: "Monthly" },
];

type Step = { kind: "form" } | { kind: "awaiting-reauth"; newPricePerDeliveryPaise: number };

/** One ACTIVE subscription's change-plan form. Calls onDone() once a change
 *  is fully settled (applied next cycle, or reauthorised) — the parent
 *  reloads + collapses this; the card's own pending-change banner is the
 *  confirmation, so this never shows a "success" message of its own. */
export function ChangePlanPanel({ sub, onDone }: { sub: Subscription; onDone: () => void }) {
  const [cadence, setCadence] = useState<SubscriptionCadence>(sub.cadence as SubscriptionCadence);
  const [meals, setMeals] = useState(sub.mealsPerDelivery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(() =>
    sub.pendingChangeReauthRequired
      ? { kind: "awaiting-reauth", newPricePerDeliveryPaise: sub.pendingPricePerDeliveryPaise ?? sub.pricePerDeliveryPaise }
      : { kind: "form" },
  );

  // A day-first plan's meals come from its per-day schedule, not a flat
  // number — the server 400s a mealsPerDelivery change on one, so disable
  // the input here rather than let the customer hit that error.
  const dayPlan = Array.isArray(sub.dayPlan) && sub.dayPlan.length > 0;
  // Preview only — the SAME pure fn the server bills from, so this can never
  // drift from what change-plan actually charges.
  const previewPrice = computeDeliveryPricePaise(cadence, meals);
  const noChange = cadence === sub.cadence && meals === sub.mealsPerDelivery;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await changePlan(sub.id, { cadence, mealsPerDelivery: meals, clientQuotedPricePerDeliveryPaise: previewPrice });
      if (res.requiresReauth) setStep({ kind: "awaiting-reauth", newPricePerDeliveryPaise: res.newPricePerDeliveryPaise });
      else onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't request that plan change.");
    } finally {
      setBusy(false);
    }
  }

  async function authorize() {
    setBusy(true);
    setError(null);
    try {
      const order = await createChangePlanReauthOrder(sub.id);
      const paid = await createRazorpayAdapter({ description: "Plan change authorisation" }).open(order);
      await confirmChangePlanReauth(sub.id, {
        razorpayPaymentId: paid.razorpayPaymentId,
        razorpayOrderId: paid.razorpayOrderId,
        razorpaySignature: paid.razorpaySignature,
      });
      onDone();
    } catch (e) {
      setError(
        e instanceof RazorpayDismissed ? "Authorisation cancelled — try again when you're ready."
          : e instanceof ApiError ? e.message
          : "Couldn't complete authorisation.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      {step.kind === "awaiting-reauth" ? (
        <>
          <p className="text-sm text-ink">
            This raises your bill to {formatPaise(step.newPricePerDeliveryPaise)}/delivery — confirm with a
            one-time payment authorisation to protect your autopay mandate&rsquo;s limit.
          </p>
          {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
          <button
            type="button" disabled={busy} onClick={() => void authorize()}
            className="self-start rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40"
          >
            {busy ? "Authorising…" : "Authorise new amount"}
          </button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Cadence
            <select
              value={cadence} onChange={(e) => setCadence(e.target.value as SubscriptionCadence)}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
            >
              {CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          {dayPlan ? (
            <p className="text-xs text-ink-faint">
              Your meals are set by your day-by-day schedule — edit individual deliveries to change them.
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Meals per delivery
              <input
                type="number" min={1} max={50} value={meals}
                onChange={(e) => setMeals(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="tabular rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
            </label>
          )}
          <p className="tabular text-sm text-ink-muted">
            {noChange
              ? `${formatPaise(sub.pricePerDeliveryPaise)}/delivery`
              : `New price: ${formatPaise(previewPrice)}/delivery (currently ${formatPaise(sub.pricePerDeliveryPaise)})`}
          </p>
          {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
          <button
            type="button" disabled={busy || noChange} onClick={() => void submit()}
            className="self-start rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40"
          >
            {busy ? "Requesting…" : "Confirm change"}
          </button>
        </>
      )}
    </div>
  );
}
