import Link from "next/link";
import { HorizontalSnapRail } from "@/components/primitives/HorizontalSnapRail";
import { routerPlans } from "@/lib/plans";

/**
 * By-goal entry rail (D-05B). Reuses the same router-reachable plan set
 * /plans' GoalRouter reads (lib/plans.ts routerPlans()) — no new fetch
 * surface. Each card is a direct shortcut into that plan, skipping the
 * router step for a visitor who already knows their goal.
 */
export function NeedStateRail() {
  const plans = routerPlans();
  return (
    <HorizontalSnapRail title="By goal" layout="grid">
      {plans.map((p) => (
        <Link
          key={p.id}
          href={`/plan/${p.id}`}
          className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
        >
          <span className="text-sm font-semibold text-ink">{p.promise}</span>
          <span className="text-xs text-ink-muted">{p.name}</span>
        </Link>
      ))}
    </HorizontalSnapRail>
  );
}
