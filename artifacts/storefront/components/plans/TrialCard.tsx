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
      className="flex flex-col gap-2 rounded-xl border border-line-strong bg-transparent p-5 transition-colors hover:border-gold"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">Not sure yet? Try 3 days first</h3>
        <span className="tabular text-sm font-semibold text-ink">{formatPaise(TRIAL_PRICE_PAISE)}</span>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{TRIAL_COPY.creditLine}</p>
      <span className="mt-1 text-sm font-semibold text-gold-text">Start the taste test &rarr;</span>
    </Link>
  );
}
