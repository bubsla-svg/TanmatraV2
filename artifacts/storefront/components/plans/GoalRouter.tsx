// Server: the answers are static spine data. The tap handling (navigate +
// funnel event) lives inside GoalCard, which is the client island — this
// section no longer needs to be one.

import { routerPlans } from "@/lib/plans";
import { GoalCard } from "./GoalCard";
import Link from "next/link";

/**
 * "What's lunch for?" — the CUJ v2 entry (02d §3). One decision, five answers,
 * with an always-present escape hatch to plain browsing (zero pressure). The
 * answer routes straight into that plan's builder.
 */
export function GoalRouter() {
  const plans = routerPlans();

  return (
    <section aria-label="What do you want lunch to do?" className="flex flex-col gap-4">
      {/* The page's h1, not an h2. /plans used to hide an h1 ("Choose your
          plan") with sr-only and show this as an h2 — so the document's one
          top-level heading was invisible, its visible headline outranked, and
          the two said different things. This question IS the page's subject
          and it is what a visitor reads first; /plans renders GoalRouter
          exactly once, so promoting it here keeps one h1 per document. */}
      <h1 className="text-2xl font-semibold tracking-tight text-ink">What do you want lunch to do?</h1>
      <div className="flex flex-col gap-3">
        {plans.map((p) => (
          <GoalCard key={p.id} planId={p.id} promise={p.promise} planName={p.name} source="plans" />
        ))}
        <Link
          href="/menu"
          className="-m-2 mt-2 self-center p-2 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
        >
          Just show me the menu &rarr;
        </Link>
      </div>
    </section>
  );
}
