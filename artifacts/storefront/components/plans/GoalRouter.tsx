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
    <section aria-label="What's lunch for?" className="flex flex-col gap-4">
      {/* The page's h1, not an h2. /plans used to hide an h1 ("Choose your
          plan") with sr-only and show this as an h2 — so the document's one
          top-level heading was invisible, its visible headline outranked, and
          the two said different things. This question IS the page's subject
          and it is what a visitor reads first; /plans renders GoalRouter
          exactly once, so promoting it here keeps one h1 per document. */}
      <h1 className="text-2xl font-semibold tracking-tight text-ink">What&rsquo;s lunch for?</h1>
      <div className="flex flex-col gap-3">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p.id, p.promise)}
            className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5 text-left text-base font-medium text-ink transition-colors hover:border-line-strong active:scale-[0.98]"
          >
            {p.promise}
            <span aria-hidden className="text-gold-text">
              &rarr;
            </span>
          </button>
        ))}
        <a
          href="/menu"
          className="-m-2 mt-2 self-center p-2 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
        >
          Just browsing &rarr;
        </a>
      </div>
    </section>
  );
}
