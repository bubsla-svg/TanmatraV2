"use client";
// Client: reads the post-checkout perks stash (sessionStorage) after the money
// event — server components can't see it.
import { useEffect, useState } from "react";
import { PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { readCheckoutPerks, type CheckoutPerks } from "@/lib/postCheckout";
import { planAllowsAddOn } from "@/lib/addons";
import { formatPaise } from "@/lib/format";
import { PostCheckoutAddOns } from "./PostCheckoutAddOns";

/**
 * Perks the money event just produced, rendered on the confirmation screen:
 * the server's verbatim UPI Autopay disclaimer from the verify response
 * (CUJ-03), a paid trial's creditback terms (CUJ-04, spine-priced), and the
 * post-purchase Evening Add attach where the purchased plan's allow-list
 * permits it (SF-11 — hidden otherwise, per the §5.1 rule). Reads in an effect
 * so server render and hydration agree; an order with nothing stashed
 * (à-la-carte, shared link, new tab) renders nothing — the confirmation stays
 * honest without inventing terms.
 */
export function PlanPerks({ orderId }: { orderId: string }) {
  const [perks, setPerks] = useState<CheckoutPerks | null>(null);

  useEffect(() => {
    setPerks(readCheckoutPerks(orderId));
  }, [orderId]);

  const creditback =
    typeof perks?.trialCreditbackPaise === "number" && perks.trialCreditbackPaise > 0
      ? perks.trialCreditbackPaise
      : null;
  // Credit already SPENT on this bill — the opposite direction from
  // creditback above (a future grant a paid trial earns). Both can appear
  // together without contradiction (e.g. a referral credit applied while the
  // trial itself is still earning its own future creditback).
  const creditApplied =
    typeof perks?.creditAppliedPaise === "number" && perks.creditAppliedPaise > 0
      ? perks.creditAppliedPaise
      : null;

  const planId =
    perks?.planId && perks.planId in PLAN_CATALOG ? (perks.planId as PlanId) : null;
  const eveningAddSubId =
    planId !== null &&
    typeof perks?.subscriptionId === "number" &&
    planAllowsAddOn(planId, "evening_add")
      ? perks.subscriptionId
      : null;

  if (
    !perks ||
    (!perks.autopayDisclaimer && creditback === null && creditApplied === null && eveningAddSubId === null)
  ) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {creditApplied !== null && (
        <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm leading-relaxed text-sage-text">
          {formatPaise(creditApplied)} in credits were applied to this order.
        </p>
      )}
      {creditback !== null && (
        <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm leading-relaxed text-sage-text">
          Your {formatPaise(creditback)} comes back as credit — start any plan within 7 days
          and it comes off that first bill.
        </p>
      )}
      {eveningAddSubId !== null && (
        <PostCheckoutAddOns subscriptionId={eveningAddSubId} />
      )}
      {perks.autopayDisclaimer && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {perks.autopayDisclaimer}
        </p>
      )}
    </div>
  );
}
