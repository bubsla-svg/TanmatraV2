import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId } from "@workspace/subscription-rules";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { planAllowsAddOn, addOnView } from "@/lib/addons";
import { planTotalAfterCredit, TRIAL_COPY } from "@/lib/trial";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { AlacarteCheckout } from "@/components/checkout/AlacarteCheckout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type Props = {
  searchParams: Promise<{
    plan?: string;
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
  const { plan, returning, credit, bump, mode } = await searchParams;

  // À-la-carte (SF-05 / CUJ-01): the guest money path — no plan, no session.
  // The cart lives client-side, so this leg is a client island; the server owns
  // pricing at POST /orders. Reached from the cart drawer's Checkout CTA.
  if (mode === "alacarte") {
    return (
      <section className="mx-auto max-w-md px-4 py-10">
        <AlacarteCheckout />
      </section>
    );
  }

  const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null;
  if (!id) redirect("/plans");
  if (!planIsSelfServiceLaunchable(id)) redirect(`/plan/${id}?waitlist=1`);

  const q = planQuoteView(id);
  const d = planDisplay(id);
  const isReturning = returning === "1";
  const isTrial = id === "trial_3day";

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
    <section className="mx-auto max-w-md px-4 py-10">
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
  );
}
