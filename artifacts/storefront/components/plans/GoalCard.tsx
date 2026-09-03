"use client";
// "use client" justification: the tap emits the funnel event that measures the
// money path's first decision. Everything else about the card is static.
import Link from "next/link";
import { emitFunnel } from "@/lib/funnel";
import { menuHrefForPlan } from "@/lib/planGoalFilter";

/**
 * One "what's lunch for?" answer, shared by BOTH surfaces that ask the
 * question — /plans (GoalRouter) and /care (NeedStateRail). Same `routerPlans()`,
 * same builder destination, ONE component, so a fix here reaches both.
 *
 * Two doors now, not one (T-15): the plan builder ("Configure plan") and the
 * menu already narrowed to the goal's dishes ("See meals"). Either surface
 * used to lead only to plan configuration, which is why Care and Plans read
 * as the same page. The links are SIBLINGS — a link inside a link is invalid
 * HTML — inside one card frame.
 *
 * Kept from the merge: a real `<Link>` (middle-click, prefetch, visible
 * destination), the plan name as subtitle, the gold arrow, and the funnel
 * event with `source` so the two entry surfaces can be compared.
 */
export function GoalCard({
  planId,
  promise,
  planName,
  source,
}: {
  planId: string;
  promise: string;
  planName: string;
  /** Which surface asked — "plans" | "care". Lands in the funnel props. */
  source: string;
}) {
  const mealsHref = menuHrefForPlan(planId);
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
      <Link
        href={`/plan/${planId}`}
        onClick={() => emitFunnel("cuj_router_answer", { planId, answer: promise, source })}
        className="flex min-h-[72px] items-center justify-between gap-3 p-5 text-left active:scale-[0.98]"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-lg font-semibold leading-tight text-primary">{promise}</span>
          <span className="text-xs text-ink-muted">{planName} · configure plan</span>
        </span>
        <span aria-hidden className="shrink-0 text-primary">
          &rarr;
        </span>
      </Link>
      {mealsHref && (
        <Link
          href={mealsHref}
          onClick={() => emitFunnel("cuj_router_answer", { planId, answer: promise, source, door: "menu" })}
          className="flex min-h-11 items-center gap-1.5 border-t border-line px-5 text-xs font-semibold text-ink-muted hover:text-ink"
        >
          See matching meals
          <span aria-hidden>&rarr;</span>
        </Link>
      )}
    </div>
  );
}
