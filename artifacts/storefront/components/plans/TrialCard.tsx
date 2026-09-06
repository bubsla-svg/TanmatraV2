import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { TRIAL_PRICE_PAISE, TRIAL_COPY } from "@/lib/trial";

/**
 * The 3-Day Taste Test offer (02f §2 / 02b). Deliberately OUTLINED, never the
 * saffron fill a plan card uses — it's the secondary CTA, not the headline. The
 * creditback line is verbatim so the offer can't be overstated.
 */
export function TrialCard() {
  return (
    <Link
      href="/trial"
      className="flex flex-col gap-3 rounded-card border border-line-strong bg-transparent p-6 transition-colors hover:border-gold active:scale-[0.98]"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">Not sure yet? Try three lunches</h3>
        <span className="tabular text-base text-ink">{formatPaise(TRIAL_PRICE_PAISE)}</span>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{TRIAL_COPY.creditLine}</p>
      <span className="mt-2 inline-flex items-center justify-center rounded-full border border-line-strong px-5 py-3 text-sm font-semibold text-ink">
        Start with 3 lunches &rarr;
      </span>
    </Link>
  );
}
