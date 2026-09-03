import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
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
    <section className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
      {/* The reference's "gentler way to commit" panel: the copy and its two
          promises on the left, the two doors on the right. */}
      <div className="rounded-[2rem] bg-secondary p-8 sm:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="animate-rise-in">
            <div aria-hidden className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary-foreground">
              <Sparkles size={20} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
              Start here
            </span>
            <h2 className="mt-4 max-w-md font-display text-4xl font-semibold leading-[1] text-primary sm:text-5xl">
              Try three lunches for {price}.
            </h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-ink-muted">
              Three weekday lunches, cooked fresh and delivered hot. Decide
              afterwards whether you want them every day.
            </p>
          </div>

          <div className="flex flex-col gap-8 animate-rise-in stagger-1">
            {/* Verbatim from lib/trial.ts — see the note above on paraphrase.
                The ✓ is the reference's accent glyph on each companion row. */}
            <ul className="flex flex-col gap-7 text-base leading-6 text-ink">
              <li className="flex gap-4 border-b border-line pb-7">
                <span aria-hidden className="font-display text-3xl leading-none text-accent">✓</span>
                {TRIAL_COPY.creditLine}
              </li>
              <li className="flex gap-4 border-b border-line pb-7">
                <span aria-hidden className="font-display text-3xl leading-none text-accent">✓</span>
                {TRIAL_COPY.noAutoConvert}
              </li>
            </ul>

            <div className="flex flex-col gap-3 sm:max-w-xs">
              <Button asChild shape="pill" size="fluid" className="min-h-12 px-8 text-sm font-bold">
                <Link href="/trial">Start with 3 lunches</Link>
              </Button>
              {/* The only other door, and it is quiet on purpose: someone who
                  already knows they want a month should not have to read the
                  trial pitch twice, but they are not who this band is for. */}
              <Link
                href="/plans"
                /* 328×20 before: a full-width text link with no vertical box of
                   its own. `w-full` because touch-target-min is inline-flex and
                   would otherwise shrink this to its text, undoing the centred
                   full-column look it has in this card. */
                className="touch-target-min w-full items-center justify-center gap-2 text-sm font-bold text-primary hover:opacity-80"
              >
                Or see monthly plans
                <ArrowRight aria-hidden size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
