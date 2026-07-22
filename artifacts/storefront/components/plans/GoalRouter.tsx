"use client";
// Client: the router captures a tap and navigates + emits a funnel event —
// interactivity the money path's first decision needs.

import { useRouter } from "next/navigation";
import { routerPlans } from "@/lib/plans";
import { emitFunnel } from "@/lib/funnel";

/**
 * "What's lunch for?" — the CUJ v2 entry (02d §3). One decision, five answers,
 * with an always-present escape hatch to plain browsing (zero pressure). The
 * answer routes straight into that plan's builder.
 */
export function GoalRouter() {
  const router = useRouter();
  const plans = routerPlans();

  function choose(planId: string, answer: string) {
    emitFunnel("cuj_router_answer", { planId, answer });
    router.push(`/plan/${planId}`);
  }

  return (
    <section aria-label="What's lunch for?" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">What&rsquo;s lunch for?</h2>
      <div className="flex flex-col gap-2">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p.id, p.promise)}
            className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:border-line-strong"
          >
            {p.promise}
            <span aria-hidden className="text-ink-faint">
              &rarr;
            </span>
          </button>
        ))}
        <a
          href="/menu"
          className="mt-1 self-start text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
        >
          Just browsing &rarr;
        </a>
      </div>
    </section>
  );
}
