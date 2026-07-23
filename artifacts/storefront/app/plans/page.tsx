import type { Metadata } from "next";
import { GoalRouter } from "@/components/plans/GoalRouter";
import { PlanCard } from "@/components/plans/PlanCard";
import { TrialCard } from "@/components/plans/TrialCard";
import { routerPlans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Plans",
  description: "RD-designed meal plans priced at the meal-card line. Pick your goal.",
};

/**
 * Plan surfaces (02f §2). Server-rendered: the goal router leads, the full
 * plan grid follows for anyone who'd rather compare. Blocked plans still
 * render — their card routes to a waitlist, never a dead end.
 */
export default function PlansPage() {
  const plans = routerPlans();
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <h1 className="sr-only">Choose your plan</h1>
      <div className="flex max-w-md flex-col gap-4">
        <GoalRouter />
        <TrialCard />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Or compare the plans
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} id={p.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
