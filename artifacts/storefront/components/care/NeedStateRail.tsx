import { CardSection } from "@/components/primitives/CardSection";
import { GoalCard } from "@/components/plans/GoalCard";
import { routerPlans } from "@/lib/plans";

/**
 * By-goal entry rail (D-05B). Same `routerPlans()` set /plans' GoalRouter
 * reads, and now the same GoalCard rendering it — a direct shortcut into the
 * plan for a visitor who already knows their goal.
 *
 * `layout="stack"`, matching /plans: these four answers carry the longest
 * labels on the page ("Get me through the workday"), which wrapped to three
 * lines in a two-column grid once the card gained its subtitle and arrow. The
 * conditions below stay a grid — their labels are one short word.
 */
export function NeedStateRail() {
  const plans = routerPlans();
  return (
    <CardSection title="By goal" layout="stack">
      {plans.map((p) => (
        <GoalCard key={p.id} planId={p.id} promise={p.promise} planName={p.name} source="care" />
      ))}
    </CardSection>
  );
}
