import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  type DietTrack,
  type PlanId,
} from "@workspace/subscription-rules";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { fetchMenu } from "@/lib/catalog";
import { planOfferDishes, type PlanOfferDish } from "@/lib/planOffer";
import { buildSharedMacroKeys } from "@/lib/dishTrust";
import { resolveTrio } from "@/lib/trialTrio";
import { planAllowsAddOn, addOnView } from "@/lib/addons";
import { planTotalAfterCredit, TRIAL_COPY, TRIAL_CREDITBACK_PAISE } from "@/lib/trial";
import { planDecisionFacts } from "@/lib/planDecisionFacts";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { AlacarteCheckout } from "@/components/checkout/AlacarteCheckout";
import { FocusHeader } from "@/components/FocusHeader";
import { PlanCheckout } from "@/components/checkout/plan/PlanCheckout";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";
import { asBuilderCycle } from "@/lib/checkoutCycle";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** Enough of the rotation to be evidence, few enough to stay above the ask on
 *  a phone. The remainder is counted, never hidden. */
const OFFER_DISH_SAMPLE = 4;

type Props = {
  searchParams: Promise<{
    plan?: string;
    track?: string;
    cycle?: string;
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
  const { plan, track, cycle, returning, credit, bump, mode } = await searchParams;

  // À-la-carte (SF-05 / CUJ-01): the guest money path — no plan, no session.
  // The cart lives client-side, so this leg is a client island; the server owns
  // pricing at POST /orders. Reached from the cart drawer's Checkout CTA.
  if (mode === "alacarte") {
    return (
      <div
        data-ui-generation="stitch-74"
        data-screen-id="8.1" data-screen-state="quote-active"
        className="min-h-dvh"
      >
        <section className="mx-auto max-w-md px-4 pt-6 pb-44">
          <FocusHeader title="Checkout" backLabel="Back to cart" trustSignal="Secure UPI checkout" />
          <AlacarteCheckout />
        </section>
      </div>
    );
  }

  const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null;
  // A bare /checkout (no ?plan, and already past the mode==="alacarte" branch
  // above) used to bounce to /plans — but the à-la-carte leg above is the one
  // that actually has a designed empty-cart state and, being a client island,
  // can reflect a real cart if one exists. /plans can't do either; it just
  // strands a customer who followed a bookmark or a bare link.
  if (!id) redirect("/checkout?mode=alacarte");
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
    // The builder confirms a cycle (Weekly/Monthly/Quarterly, each a different
    // price) and sends it here as ?cycle=. Previously dropped on the floor —
    // this page quoted and billed every plan as monthly regardless of what the
    // customer picked. Validate against the fixed set the builder can emit;
    // an absent or unrecognised value falls back to monthly, the builder's
    // own default, never a guess.
    const requestedCadence = asBuilderCycle(cycle);
    const withRdBump = bump === "1" && planAllowsAddOn(id, "rd_bump");
    // N5.11: the sign-in gate used to be a bare phone field in empty canvas —
    // the customer was asked for their number before being reminded what they
    // were buying. This recap is the SPINE's list quote for the exact
    // (plan, track, cadence) selection — the same server-owned figures /plans
    // already shows anonymous visitors — so the gate can restate the offer
    // without inventing a number. The post-auth server quote (net of credit)
    // remains the billed amount.
    // No invented cadence fallback: absent ?cycle=, computePlanQuote uses the
    // plan's OWN cycle — which for trial_3day is "one_off". Forcing "monthly"
    // here would caption a no-auto-renew ₹399 trial as "billed monthly",
    // contradicting the noAutoConvert fine print on the very next screen.
    const recapQuote = computePlanQuote(
      id,
      requestedTrack ?? q.servedTracks[0] ?? "veg",
      requestedCadence,
    );
    // Laws 1 + 8: the same figures, plus the dishes and the delivery window,
    // shown ABOVE the serviceability gate — the journey's first ask. Resolved
    // here because the rotation comes off the live catalog and PlanCheckout is
    // a client island that cannot read it. Only the requested track's rotation
    // when one was chosen: showing a chicken dish to someone who arrived on
    // ?track=veg would be a worse answer than showing fewer.
    const { dishes: catalogDishes } = await fetchMenu();
    // T-16: the trial is three FIXED dishes, and /trial already showed them —
    // so the checkout shows the same trio, from the same resolver, for the
    // same track. A sample of the plan's rotation is the wrong answer for a
    // product whose whole promise is these three specific lunches.
    const rotation: { dishes: PlanOfferDish[]; more: number } = isTrial
      ? {
          dishes: resolveTrio(
            requestedTrack === "nonveg" ? "nonveg" : "veg",
            catalogDishes,
            buildSharedMacroKeys(catalogDishes),
          ).map((d) => ({
            slug: d.slug,
            name: d.name,
            image: d.image,
            ...(d.macros ? { macros: d.macros } : {}),
            macrosEstimated: d.macrosEstimated === true,
          })),
          more: 0,
        }
      : planOfferDishes(
          id,
          requestedTrack ? [requestedTrack] : q.servedTracks,
          catalogDishes,
          OFFER_DISH_SAMPLE,
        );
    return (
      <div data-ui-generation="stitch-74" data-screen-id="8.1" data-screen-state="quote-active" className="min-h-dvh">
        <section className="mx-auto max-w-md px-4 pt-10 pb-44">
          {/* D-16: the à-la-carte checkout's own "Back to cart" pattern —
              FocusHeader's goBack() is real history navigation (router.back()),
              not a fresh push, so returning lands on the SAME /plan/[planId]
              instance rather than a reset one. No `title`: PlanIdentityGate
              and PlanCheckout each already render their own contextual h1
              ("Start your X plan" / the plan name) — FocusHeader's own doc
              comment names this exact case as the reason `title` is optional.

              N5.10: no trustSignal here any more. This header renders on the
              IDENTITY stage too, where the only transaction is an SMS code —
              "Secure UPI checkout" over an OTP field misdescribes the moment.
              The pay stage carries its own trust line beside the actual pay
              CTA (PlanDetails' bar), which is where the claim is true. */}
          <FocusHeader backLabel="Back to plan" />
          <PlanCheckout
            planId={id}
            planName={d.name}
            servedTracks={q.servedTracks}
            initialTrack={requestedTrack}
            cadence={requestedCadence}
            addOns={withRdBump ? ["rd_bump"] : undefined}
            // A plan used to pass `undefined`, so the purchase that registers a
            // recurring UPI Autopay mandate disclosed LESS at the decision
            // moment than the trial, which registers none.
            finePrint={
              isTrial
                ? [TRIAL_COPY.creditLine, TRIAL_COPY.noAutoConvert]
                : planDecisionFacts(id, requestedCadence)
            }
            successPerks={isTrial ? { trialCreditbackPaise: TRIAL_CREDITBACK_PAISE } : undefined}
            recap={{
              mealsPerCycle: recapQuote.mealsPerCycle,
              cycleTotalPaise: recapQuote.cycleTotalPaise,
              cadence: recapQuote.cycle,
            }}
            offer={{
              dishes: rotation.dishes,
              more: rotation.more,
              mealsPerCycle: recapQuote.mealsPerCycle,
              cycleTotalPaise: recapQuote.cycleTotalPaise,
              cadence: recapQuote.cycle,
            }}
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
    <div 
      data-ui-generation="stitch-74" 
      data-screen-id="8.1" data-screen-state="quote-active"
      className="min-h-dvh"
    >
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
