import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId } from "@workspace/subscription-rules";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type Props = {
  searchParams: Promise<{ plan?: string; returning?: string }>;
};

/**
 * Checkout host (server). Prices the plan through the spine (the same quote the
 * server bills from — IMP §10.1) and hands the total to the Breeze flow. A
 * blocked plan can't be checked out — it's bounced to its waitlist. `returning=1`
 * demonstrates the tap-only, zero-typed-field returning-user path.
 */
export default async function CheckoutPage({ searchParams }: Props) {
  const { plan, returning } = await searchParams;
  const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null;
  if (!id) redirect("/plans");
  if (!planIsSelfServiceLaunchable(id)) redirect(`/plan/${id}?waitlist=1`);

  const q = planQuoteView(id);
  const d = planDisplay(id);
  const isReturning = returning === "1";

  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <CheckoutFlow
        planId={id}
        planSummary={`${d.name} · ${q.mealsPerCycle} lunches`}
        totalPaise={q.cycleTotalPaise}
        futureLine="Next billing next month · pause or cancel anytime."
        user={{ signedIn: isReturning, hasSavedAddress: isReturning }}
      />
    </section>
  );
}
