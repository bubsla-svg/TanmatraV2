import type { Metadata } from "next";
import { computePlanQuote } from "@workspace/subscription-rules";
import { fetchMenu } from "@/lib/catalog";
import { buildSharedMacroKeys } from "@/lib/dishTrust";
import { formatPaise } from "@/lib/format";
import { TRIAL_PRICE_PAISE, TRIAL_COPY } from "@/lib/trial";
import { resolveTrio, type TrialTrack, type TrioDish } from "@/lib/trialTrio";
import { TrialStart } from "@/components/trial/TrialStart";
import { FocusHeader } from "@/components/FocusHeader";

export const metadata: Metadata = {
  title: "Try three lunches",
  description:
    "Three lunches for ₹399 — every rupee credited back the moment you start a plan.",
};

/**
 * The 3-Day Taste Test surface (02b). Server-rendered: the offer promise + the
 * verbatim creditback line, then the (client) track picker + fixed trio. The
 * server owns eligibility (one per phone, ever — #287); this page only presents
 * the offer honestly.
 */
export default async function TrialPage() {
  const { dishes } = await fetchMenu();
  const sharedMacroKeys = buildSharedMacroKeys(dishes);
  const trios: Record<TrialTrack, TrioDish[]> = {
    veg: resolveTrio("veg", dishes, sharedMacroKeys),
    nonveg: resolveTrio("nonveg", dishes, sharedMacroKeys),
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
          <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
            Not ready for a month?
          </span>
          <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">
            Try three lunches for {formatPaise(TRIAL_PRICE_PAISE)}
          </h1>
          <p className="max-w-[280px] text-sm leading-relaxed text-ink-muted">
            {TRIAL_COPY.creditLine}
          </p>
        </div>

        <TrialStart trios={trios} pricePaise={TRIAL_PRICE_PAISE} />

        {/* Secondary reassurance card — deliberately smaller type and less
            visual weight than the hero + trio + CTA above (Brief 23). */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold leading-tight text-primary">What happens after the trial?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            After your trial, you can start a regular subscription. Our most
            popular plan starts at{" "}
            <span className="font-data font-bold text-primary">
              {formatPaise(deskFuelWeekly.cycleTotalPaise)}/week
            </span>{" "}
            or{" "}
            <span className="font-data font-bold text-primary">
              {formatPaise(deskFuelMonthly.cycleTotalPaise)}/month
            </span>
            .
          </p>
          <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-xs text-ink-muted">
            There are no lock-ins — you can cancel anytime.
          </p>
        </div>

        {/* Second secondary card — same subordinate treatment. */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold leading-tight text-primary">How the creditback works</h2>
          <ol className="mt-4 flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-data text-3xs font-bold text-ink-muted">
                1
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-ink-muted">
                Pay <span className="font-data font-bold text-primary">{formatPaise(TRIAL_PRICE_PAISE)}</span> today — three lunches, three weekdays.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-data text-3xs font-bold text-ink-muted">
                2
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-ink-muted">
                Like it? Start any plan within 7 days.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-data text-3xs font-bold text-ink-muted">
                3
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-ink-muted">
                Your full <span className="font-data font-bold text-primary">{formatPaise(TRIAL_PRICE_PAISE)}</span> comes off that first bill — so
                the trial costs nothing if you continue.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
