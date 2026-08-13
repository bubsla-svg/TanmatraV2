import type { Metadata } from "next";
import type { DishData } from "@workspace/menu-catalog";
import { computePlanQuote } from "@workspace/subscription-rules";
import { fetchMenu, findDish } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";
import { TRIAL_TRIO, TRIAL_PRICE_PAISE, TRIAL_COPY } from "@/lib/trial";
import { TrialStart, type TrioDish } from "@/components/trial/TrialStart";
import { FocusHeader } from "@/components/FocusHeader";

export const metadata: Metadata = {
  title: "3-Day Taste Test",
  description:
    "Three RD-designed lunches for ₹399 — every rupee credited back the moment you start a plan.",
};

type TrialTrack = "veg" | "nonveg";

/** Resolve a track's fixed slug trio against the live menu (name + image for
 *  the preview). Missing slugs are dropped, not faked — the price stays the
 *  spine's regardless. */
function resolveTrio(track: TrialTrack, dishes: DishData[]): TrioDish[] {
  return TRIAL_TRIO[track]
    .map((slug) => findDish(slug, dishes))
    .filter((d): d is DishData => Boolean(d))
    .map((d) => ({ slug: d.slug, name: d.name, image: d.image }));
}

/**
 * The 3-Day Taste Test surface (02b). Server-rendered: the offer promise + the
 * verbatim creditback line, then the (client) track picker + fixed trio. The
 * server owns eligibility (one per phone, ever — #287); this page only presents
 * the offer honestly.
 */
export default async function TrialPage() {
  const { dishes } = await fetchMenu();
  const trios: Record<TrialTrack, TrioDish[]> = {
    veg: resolveTrio("veg", dishes),
    nonveg: resolveTrio("nonveg", dishes),
  };

  const deskFuelWeekly = computePlanQuote("desk_fuel", "veg", "weekly");
  const deskFuelMonthly = computePlanQuote("desk_fuel", "veg", "monthly");

  return (
    <div data-ui-generation="stitch-74" data-screen-id="6.8" data-screen-state="default" className="min-h-dvh">
      {/* pb-48 clears the sticky footer TrialStart renders (button + the
          no-auto-convert line) so the creditback card is never hidden behind
          it while scrolling — same reasoning as /checkout's pb-44. */}
      <section className="mx-auto flex max-w-md flex-col gap-8 px-4 pt-6 pb-48">
        {/* No title prop — the hero below already carries a real h1, and a
            second generic "Trial" heading above it would only compete with
            it. The back button is the part of the FocusLayout contract that
            actually matters here (this page had none at all). */}
        <FocusHeader backLabel="Back to plans" />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-text">
            Not ready for a month?
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Try 3 lunches for {formatPaise(TRIAL_PRICE_PAISE)}
          </h1>
          <p className="max-w-[280px] text-sm leading-relaxed text-ink-muted">
            {TRIAL_COPY.creditLine}
          </p>
        </div>

        <TrialStart trios={trios} pricePaise={TRIAL_PRICE_PAISE} />

        {/* Secondary reassurance card — deliberately smaller type and less
            visual weight than the hero + trio + CTA above (Brief 23). */}
        <div className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">What happens after the trial?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            After your Taste Test, you can start a regular subscription. Our most
            popular plan starts at{" "}
            <span className="tabular font-semibold text-ink">
              {formatPaise(deskFuelWeekly.cycleTotalPaise)}/week
            </span>{" "}
            or{" "}
            <span className="tabular font-semibold text-gold-text">
              {formatPaise(deskFuelMonthly.cycleTotalPaise)}/month
            </span>
            .
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            There are no lock-ins — you can cancel anytime.
          </p>
        </div>

        {/* Second secondary card — same subordinate treatment. */}
        <div className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">How the creditback works</h2>
          <ol className="mt-4 flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-3xs font-medium text-ink-faint">
                1
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-ink-muted">
                Pay {formatPaise(TRIAL_PRICE_PAISE)} today — three lunches, three weekdays.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-3xs font-medium text-ink-faint">
                2
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-ink-muted">
                Like it? Start any plan within 7 days.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-3xs font-medium text-ink-faint">
                3
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-ink-muted">
                Your full {formatPaise(TRIAL_PRICE_PAISE)} comes off that first bill — so
                the trial costs nothing if you continue.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
