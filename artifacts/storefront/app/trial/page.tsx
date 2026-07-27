import type { Metadata } from "next";
import type { DishData } from "@workspace/menu-catalog";
import { computePlanQuote } from "@workspace/subscription-rules";
import { fetchMenu, findDish } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";
import { TRIAL_TRIO, TRIAL_PRICE_PAISE, TRIAL_COPY } from "@/lib/trial";
import { TrialStart, type TrioDish } from "@/components/trial/TrialStart";

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
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Not ready for a month?
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Try 3 lunches for {formatPaise(TRIAL_PRICE_PAISE)}
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">{TRIAL_COPY.creditLine}</p>
      </div>

      <TrialStart trios={trios} pricePaise={TRIAL_PRICE_PAISE} />

      <div className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">How the creditback works</h2>
        <ol className="mt-2 flex flex-col gap-1.5 text-sm text-ink-muted">
          <li>1. Pay {formatPaise(TRIAL_PRICE_PAISE)} today — three lunches, three weekdays.</li>
          <li>2. Like it? Start any plan within 7 days.</li>
          <li>
            3. Your full {formatPaise(TRIAL_PRICE_PAISE)} comes off that first bill — so the
            trial costs nothing if you continue.
          </li>
        </ol>

        <div className="mt-5 border-t border-line pt-4">
          <h2 className="text-sm font-semibold text-ink">What happens after the trial?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            After your Taste Test, you can start a regular subscription. Our most popular plan starts at <strong>{formatPaise(deskFuelWeekly.cycleTotalPaise)}/week</strong> or <strong>{formatPaise(deskFuelMonthly.cycleTotalPaise)}/month</strong>.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            There are no lock-ins — you can cancel anytime.
          </p>
        </div>
      </div>
    </section>
  );
}
