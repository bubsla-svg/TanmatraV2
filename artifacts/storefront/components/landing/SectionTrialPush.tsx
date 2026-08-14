import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPaise } from "@/lib/format";
import { TRIAL_PRICE_PAISE, TRIAL_COPY } from "@/lib/trial";

/**
 * The 3-day trial, given its own band on the homepage.
 *
 * The trial was previously reachable only as the SECOND button on each plan
 * card — the small ghost pill under "View Subscription Options" — which asked a
 * first-time visitor to pick a monthly plan before it offered them the cheap
 * way to find out whether they like the food. That is the wrong order: the
 * trial is the lowest-risk yes on the page and it converts the people who are
 * not ready to commit to a month of lunches from a kitchen they have never
 * tasted.
 *
 * Every number and term here comes from lib/trial.ts — the same source /trial
 * and checkout use, so the price on this band is the price that gets charged.
 * `TRIAL_COPY` is quoted verbatim rather than paraphrased: the creditback and
 * the no-auto-renew line are commercial promises, and a paraphrase of a promise
 * is a second, slightly different promise.
 *
 * Server Component — one link, no state.
 */
export function SectionTrialPush() {
  const price = formatPaise(TRIAL_PRICE_PAISE);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <div className="overflow-hidden rounded-card border-2 border-gold/40 bg-surface-raised p-6 shadow-md sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
              Start here
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Try three lunches for {price}.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Three weekday lunches, cooked fresh and delivered hot. Decide
              afterwards whether you want them every day.
            </p>

            {/* Verbatim from lib/trial.ts — see the note above on paraphrase. */}
            <ul className="mt-6 flex flex-col gap-2.5 text-sm text-ink">
              <li className="flex gap-2.5">
                <span aria-hidden className="text-gold-text">✓</span>
                {TRIAL_COPY.creditLine}
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-gold-text">✓</span>
                {TRIAL_COPY.noAutoConvert}
              </li>
            </ul>
          </div>

          <div className="flex shrink-0 flex-col gap-3 lg:w-64">
            <Button asChild shape="xl" size="fluid" className="px-8 py-4 text-base font-bold shadow-lg shadow-gold/20">
              <Link href="/trial">Start with 3 lunches</Link>
            </Button>
            {/* The only other door, and it is quiet on purpose: someone who
                already knows they want a month should not have to read the
                trial pitch twice, but they are not who this band is for. */}
            <Link
              href="/plans"
              className="text-center text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Or see monthly plans
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
