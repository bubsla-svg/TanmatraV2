"use client";
// "use client" justification: the tap emits the funnel event that measures the
// money path's first decision. Everything else about the card is static.
import Link from "next/link";
import { emitFunnel } from "@/lib/funnel";

/**
 * One "what's lunch for?" answer, shared by BOTH surfaces that ask the
 * question — /plans (GoalRouter) and /care (NeedStateRail). They read the same
 * `routerPlans()` and route to the same builder, but used to render it two
 * different ways: a `<button>` at 34px radius with a gold arrow and no
 * subtitle on /plans, an `<a>` at 22px radius with a subtitle and no arrow on
 * /care. Same words, same destination, two components — so a fix to one
 * silently skipped the other.
 *
 * The merged card keeps the better half of each:
 *  - a real `<Link>`, not button + router.push — middle-click, open-in-new-tab
 *    and prefetch all work again, and the destination is visible on hover;
 *  - the plan name as a subtitle (/care's), so the answer says what it routes
 *    to rather than just restating the question;
 *  - the gold arrow (/plans'), the affordance that says this navigates;
 *  - the funnel event, which ONLY /plans emitted — /care's identical taps were
 *    invisible to the scoreboard. `source` distinguishes them, so the two entry
 *    surfaces can finally be compared instead of silently pooled.
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
  return (
    <Link
      href={`/plan/${planId}`}
      onClick={() => emitFunnel("cuj_router_answer", { planId, answer: promise, source })}
      className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong active:scale-[0.98]"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-medium text-ink">{promise}</span>
        <span className="text-xs text-ink-muted">{planName}</span>
      </span>
      <span aria-hidden className="shrink-0 text-gold-text">
        &rarr;
      </span>
    </Link>
  );
}
