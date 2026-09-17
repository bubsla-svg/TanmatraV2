import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { TRIAL_PRICE_PAISE, TRIAL_COPY } from "@/lib/trial";
import { PLAN_CHECKOUT_ENABLED } from "@/lib/flags";

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
        {/* h2: this is the first heading under /plans' h1, and every other
            section on that page is an h2 — an h3 here skipped a level. */}
        <h2 className="text-base font-semibold text-ink">Not sure yet? Try three lunches</h2>
        {/* T1: with plan checkout dark the trio is priced by the menu, so no
            figure is stated here — /trial shows the server's sum. */}
        {PLAN_CHECKOUT_ENABLED && (
          <span className="tabular text-base text-ink">{formatPaise(TRIAL_PRICE_PAISE)}</span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">
        {PLAN_CHECKOUT_ENABLED
          ? TRIAL_COPY.creditLine
          : "Three chef-cooked lunches off today's menu, at menu price. Order once — no plan, nothing renews."}
      </p>
      <span className="mt-2 inline-flex items-center justify-center rounded-full border border-line-strong px-5 py-3 text-sm font-semibold text-ink">
        Start with 3 lunches &rarr;
      </span>
    </Link>
  );
}
