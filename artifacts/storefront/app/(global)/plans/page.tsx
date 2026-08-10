import type { Metadata } from "next";
import Link from "next/link";
import { GoalRouter } from "@/components/plans/GoalRouter";
import { PlanCardStitch } from "@/components/plans/PlanCardStitch";
import { TrialCard } from "@/components/plans/TrialCard";
import { routerPlans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Plans",
  description: "RD-designed meal plans priced at the meal-card line. Pick your goal.",
};

/**
 * Plan surfaces (02f §2). Server-rendered: the goal router leads, the full
 * plan grid follows for anyone who'd rather compare. Blocked plans still
 * render — their card routes to a waitlist, never a dead end (02d §8).
 * Teams is sales-led (routerAnswer null in PLAN_CATALOG), so it appears as
 * a static sales link to /corporate rather than a self-serve card.
 */
export default function PlansPage() {
  const plans = routerPlans();
  return (
    <div 
      data-ui-generation="stitch-74" 
      data-screen-id="6.1"
      data-screen-state="default"
      className="min-h-dvh"
    >
      <section className="mx-auto flex max-w-md flex-col gap-10 px-4 py-10">
        <h1 className="sr-only">Choose your plan</h1>
        <GoalRouter />
        <TrialCard />

        <div className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Other plans that may fit
          </h2>
          <div className="flex flex-col gap-5">
            {plans.map((p) => (
              <PlanCardStitch key={p.id} id={p.id} />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 border-t border-line pt-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Corporate solutions
          </p>
          <h2 className="text-lg font-semibold text-ink">Tanmatra for Teams</h2>
          <Link
            href="/corporate"
            className="-m-2 mt-1 p-2 text-sm font-semibold text-gold-text underline-offset-4 hover:underline"
          >
            Talk to sales &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
