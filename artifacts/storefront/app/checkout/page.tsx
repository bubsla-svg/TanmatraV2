import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId } from "@workspace/subscription-rules";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { planTotalAfterCredit, TRIAL_COPY } from "@/lib/trial";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type Props = {
  searchParams: Promise<{ plan?: string; returning?: string; credit?: string }>;
};

/**
 * Checkout host (server). Prices the plan through the spine (the same quote the
 * server bills from — IMP §10.1) and hands the total to the Breeze flow. A
 * blocked plan can't be checked out — it's bounced to its waitlist. `returning=1`
 * demonstrates the tap-only, zero-typed-field returning-user path; `credit=1`
 * demonstrates a post-trial buyer whose ₹399 comes off the first bill.
 */
export default async function CheckoutPage({ searchParams }: Props) {
  const { plan, returning, credit } = await searchParams;
  const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null;
  if (!id) redirect("/plans");
  if (!planIsSelfServiceLaunchable(id)) redirect(`/plan/${id}?waitlist=1`);

  const q = planQuoteView(id);
  const d = planDisplay(id);
  const isReturning = returning === "1";
  const isTrial = id === "trial_3day";

  // The trial earns credit; it never spends it. A returning buyer who did the
  // trial (credit=1) sees the ₹399 come off a real plan's first bill. The
  // server owns eligibility (#287); this only displays the applied amount,
  // clamped by the spine so it can never exceed the bill.
  const gross = q.cycleTotalPaise;
  const net = credit === "1" && !isTrial ? planTotalAfterCredit(gross) : gross;
  const creditPaise = gross - net;

  const futureLine = isTrial
    ? TRIAL_COPY.noAutoConvert
    : "Next billing next month · pause or cancel anytime.";

  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <CheckoutFlow
        planId={id}
        planSummary={`${d.name} · ${q.mealsPerCycle} lunches`}
        totalPaise={net}
        futureLine={futureLine}
        creditPaise={creditPaise}
        user={{ signedIn: isReturning, hasSavedAddress: isReturning }}
      />
    </section>
  );
}
