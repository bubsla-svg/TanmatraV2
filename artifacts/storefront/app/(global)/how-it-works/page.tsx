import type { Metadata } from "next";
import Link from "next/link";
import { PLAN_DELIVERY_DAYS_LABEL, PLAN_DELIVERY_WINDOW_LABEL } from "@/lib/planCheckout";
import { bookablePlans, renewalIsMixed, SKIP_SWAP_SENTENCE } from "@/lib/howItWorks";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What arrives, when it arrives, how to skip or swap a delivery, and exactly which plans renew.",
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
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Plans</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How it works</h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">
          What arrives, when it arrives, how to change a delivery, and which
          plans keep charging you.
        </p>
      </header>

      <h2 className="mt-10 text-lg font-semibold text-ink">When food arrives</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        Delivered {PLAN_DELIVERY_DAYS_LABEL.toLowerCase()}, {PLAN_DELIVERY_WINDOW_LABEL}. Your first
        delivery is the next weekday after you order — deliveries never land on a
        weekend.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-ink">Changing a delivery</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{SKIP_SWAP_SENTENCE}</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        After the cutoff the kitchen has already begun that meal, so it can no
        longer be changed — your account will say so and tell you the next
        delivery you can still change.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-ink">
        {mixed ? "Which plans renew — and which do not" : "Renewal"}
      </h2>
      {mixed && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          It depends on the billing frequency you choose, not on which plan you
          choose. Weekly and monthly billing set up UPI Autopay and renew until
          you cancel, with a notification before each charge. Quarterly does
          not — you pay once for that quarter, nothing renews automatically,
          and you come back when you want the next one. The one-off trial never
          renews. Every plan below is quoted monthly unless you pick otherwise.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {plans.map((plan) => (
          <article key={plan.planId} className="rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">{plan.name}</h3>
              <span className="text-xs font-medium text-ink-faint">
                {plan.cycles.length === 1
                  ? plan.cycles[0]!.renews
                    ? "Renews automatically"
                    : "Does not renew"
                  : "Depends on the billing frequency you pick"}
              </span>
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
              className="mt-3 inline-block text-sm font-medium text-gold-text underline-offset-4 hover:underline"
            >
              See {plan.name}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-10 max-w-prose text-sm leading-relaxed text-ink-muted">
        Still deciding?{" "}
        <Link href="/menu" className="font-medium text-gold-text underline-offset-4 hover:underline">
          Browse the menu
        </Link>{" "}
        — every dish can be ordered on its own, with no plan at all.
      </p>
    </section>
  );
}
