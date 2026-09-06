import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_DELIVERY_DAYS_SENTENCE } from "@/lib/planCheckout";
import { bookablePlans, renewalIsMixed, SKIP_SWAP_SENTENCE } from "@/lib/howItWorks";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What arrives, when, how to change it, and what renews.",
};

/**
 * How it works (plan item 2.1).
 *
 * Every fact here is derived — the delivery days and window from the constants
 * the create call books with, the cutoff from the constant the server enforces,
 * and the per-plan lines from `planDecisionFacts`, the same function that
 * prints the fine print beneath the pay button. Nothing on this page is copy
 * that could drift from the screen it explains; see lib/howItWorks.
 *
 * The renewal section splits by CYCLE, not by plan. The answer genuinely
 * differs per cycle — weekly and monthly register a real UPI Autopay mandate
 * (lib/planDecisionFacts mirrors api-server's AUTOPAY_CADENCES), quarterly is
 * prepaid, the trial is one-off — so a single per-plan verdict would be wrong
 * for whoever picked the other cycle. The customers a help page most cannot
 * afford to mislead are the ones who get charged again. See lib/howItWorks.
 */
export default function HowItWorksPage() {
  const plans = bookablePlans();
  const mixed = renewalIsMixed(plans);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">How it works</h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
          What arrives, when, how to change it, and what renews.
        </p>
      </header>

      <h2 className="mt-10 font-display text-lg font-semibold text-primary">When food arrives</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        Delivered {PLAN_DELIVERY_DAYS_SENTENCE}. Your first
        delivery is the next weekday after you order — deliveries never land on a
        weekend.
      </p>

      <h2 className="mt-10 font-display text-lg font-semibold text-primary">Changing a delivery</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{SKIP_SWAP_SENTENCE}</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        After the cutoff the kitchen has already begun that meal, so it can no
        longer be changed — your account will say so and tell you the next
        delivery you can still change.
      </p>

      <h2 className="mt-10 font-display text-lg font-semibold text-primary">
        {mixed ? "What renews" : "Renewal"}
      </h2>
      {mixed && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          Weekly and monthly billing renew by UPI Autopay until you cancel — we
          message you before every charge. Quarterly is a one-time payment. The
          3-lunch trial never renews.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {plans.map((plan) => (
          <article key={plan.planId} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-sm font-semibold text-primary">{plan.name}</h3>
              {plan.cycles.length === 1 && (
                <span className="text-xs font-medium text-ink-faint">
                  {plan.cycles[0]!.renews ? "Renews automatically" : "Does not renew"}
                </span>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {plan.facts.map((fact) => (
                <li key={fact} className="text-sm leading-relaxed text-ink-muted">
                  {fact}
                </li>
              ))}
            </ul>
            {plan.cycles.length > 1 && (
              // Per cycle, because the answer differs per cycle. Printing one
              // verdict for the plan would be wrong for whoever picked the
              // other cycle — and they are the ones being charged again.
              <ul className="mt-3 flex flex-wrap gap-2">
                {plan.cycles.map((c) => (
                  <li
                    key={c.cycle}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink-muted"
                  >
                    Billed {c.cycle} — {c.renews ? "renews until you cancel" : "does not renew"}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/plan/${plan.planId}`}
              className="mt-3 inline-block py-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              See {plan.name}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-10 max-w-prose text-sm leading-relaxed text-ink-muted">
        Or skip plans entirely —{" "}
        <Link href="/menu" className="font-medium text-primary underline-offset-4 hover:underline">
          every dish can be ordered on its own
        </Link>
        .
      </p>
    </section>
  );
}
