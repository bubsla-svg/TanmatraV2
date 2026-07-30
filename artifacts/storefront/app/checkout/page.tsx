import type { Metadata } from "next";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import { redirect } from "next/navigation";
import {
  PLAN_CATALOG,
  planIsSelfServiceLaunchable,
  type DietTrack,
  type PlanId,
} from "@workspace/subscription-rules";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { planAllowsAddOn, addOnView } from "@/lib/addons";
import { planTotalAfterCredit, TRIAL_COPY, TRIAL_CREDITBACK_PAISE } from "@/lib/trial";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { AlacarteCheckout } from "@/components/checkout/AlacarteCheckout";
import { PlanCheckout } from "@/components/checkout/plan/PlanCheckout";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type Props = {
  searchParams: Promise<{
    plan?: string;
    track?: string;
    returning?: string;
    credit?: string;
    bump?: string;
    mode?: string;
  }>;
};

/**
 * Checkout host (server). Prices the plan through the spine (the same quote the
 * server bills from — IMP §10.1) and hands the total to the Breeze flow. A
 * blocked plan can't be checked out — it's bounced to its waitlist. `returning=1`
 * = the tap-only returning path; `credit=1` = a post-trial buyer whose ₹399
 * comes off the first bill; `bump=1` = the RD add-on accepted at plan review.
 */
export default async function CheckoutPage({ searchParams }: Props) {
  const { plan, track, returning, credit, bump, mode } = await searchParams;

  // À-la-carte (SF-05 / CUJ-01): the guest money path — no plan, no session.
  // The cart lives client-side, so this leg is a client island; the server owns
  // pricing at POST /orders. Reached from the cart drawer's Checkout CTA.
  if (mode === "alacarte") {
    return (
      <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
        <section className="mx-auto max-w-md px-4 pt-10 pb-44">
          <AlacarteCheckout />
        </section>
      </div>
    );
  }

  const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null;
  if (!id) redirect("/plans");
  if (!planIsSelfServiceLaunchable(id)) redirect(`/plan/${id}?waitlist=1`);

  const q = planQuoteView(id);
  const d = planDisplay(id);
  const isReturning = returning === "1";
  const isTrial = id === "trial_3day";

  // Live plan money path (SF-07/09/11 · CUJ-02/03/04): identity → eater
  // profile → address → real pay via createSubscription. The server prices
  // from planId AND flips the trial branch (one-off sampler, creditback at
  // paid time, one per phone — 409 trial_already_redeemed) from planId ===
  // "trial_3day" itself, so trial and plan share one create path. An accepted
  // RD bump (`bump=1`, allow-list-gated) is threaded through quote AND create —
  // the server bills it, so display equals charge. Post-trial credit needs no
  // special-casing here any more: once signed in, PlanCheckout reads the
  // account's real credit-ledger balance (GET /credit-ledger) and shows the
  // net total; subscriptions.ts redeems the same balance automatically at
  // create time. `credit=1` is accepted for back-compat with existing links
  // but no longer gates which surface renders.
  if (LIVE_CHECKOUT_ENABLED) {
    const requestedTrack =
      track && q.servedTracks.includes(track as DietTrack) ? (track as DietTrack) : undefined;
    const withRdBump = bump === "1" && planAllowsAddOn(id, "rd_bump");
    return (
      <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
        <section className="mx-auto max-w-md px-4 pt-10 pb-44">
          <PlanCheckout
            planId={id}
            planName={d.name}
            servedTracks={q.servedTracks}
            initialTrack={requestedTrack}
            addOns={withRdBump ? ["rd_bump"] : undefined}
            finePrint={isTrial ? [TRIAL_COPY.creditLine, TRIAL_COPY.noAutoConvert] : undefined}
            successPerks={isTrial ? { trialCreditbackPaise: TRIAL_CREDITBACK_PAISE } : undefined}
          />
        </section>
      </div>
    );
  }

  // Credit applies to the base plan only (the trial earns it; #287 owns
  // eligibility). The RD bump is added on top — a bump is never discounted.
  const base = q.cycleTotalPaise;
  const afterCredit = credit === "1" && !isTrial ? planTotalAfterCredit(base) : base;
  const creditPaise = base - afterCredit;

  const applyBump = bump === "1" && planAllowsAddOn(id, "rd_bump");
  const bumpPaise = applyBump ? addOnView("rd_bump").pricePaise : 0;
  const total = afterCredit + bumpPaise;

  // Evening Add is offered post-purchase on the confirmation, where the plan
  // permits it (never on the trial — its allow-list is empty).
  const eveningAddPaise = planAllowsAddOn(id, "evening_add")
    ? addOnView("evening_add").pricePaise
    : null;

  const futureLine = isTrial
    ? TRIAL_COPY.noAutoConvert
    : "Next billing next month · pause or cancel anytime.";

  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
      <section className="mx-auto max-w-md px-4 pt-10 pb-44">
        <CheckoutFlow
          planId={id}
          planSummary={`${d.name} · ${q.mealsPerCycle} lunches${applyBump ? " · + dietitian" : ""}`}
          totalPaise={total}
          futureLine={futureLine}
          creditPaise={creditPaise}
          eveningAddPaise={eveningAddPaise}
          user={{ signedIn: isReturning, hasSavedAddress: isReturning }}
        />
      </section>
    </div>
  );
}
