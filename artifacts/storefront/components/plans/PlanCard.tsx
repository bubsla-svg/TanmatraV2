import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import type { PlanId } from "@workspace/subscription-rules";

/**
 * Plan surface card (02f §2; Stitch brief 15 restyle — shared by /metabolic,
 * /care and /protocol). Server component. A launchable plan links into its
 * builder; a blocked plan (empty pool / pending SKUs) routes to waitlist
 * capture instead — never a dead end (02d §8).
 *
 * Money-path presentation is fixed: prices are spine-quoted via planQuoteView
 * and rendered verbatim in tabular figures, and gold appears ONLY on the action
 * pill — never on the amount, so the price can never read as a promotion. The
 * brief's "PROTOCOL 01" style badge is bound to the plan's real RD-reviewed
 * flag rather than inventing a tier label.
 */
const CYCLE_SUFFIX: Record<string, string> = {
  weekly: "per week",
  fortnightly: "per fortnight",
  monthly: "per month",
  quarterly: "per quarter",
  one_off: "one-off",
};

export function PlanCard({ id }: { id: PlanId }) {
  const d = planDisplay(id);
  const q = planQuoteView(id);
  const href = q.launchable ? `/plan/${id}` : `/plan/${id}?waitlist=1`;

  return (
    <Link
      href={href}
      className="@container flex h-full flex-col rounded-3xl border bg-surface p-6 shadow-[var(--shadow-card)] transition-colors hover:border-line-strong"
      style={{ borderColor: q.launchable ? "var(--line-strong)" : "var(--line)" }}
    >
      <h3 className="text-xl font-semibold tracking-tight text-ink">{d.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{d.subtitle}</p>

      <div className="mt-auto flex flex-col items-start gap-3 border-t border-line pt-6 @xs:flex-row @xs:items-end @xs:justify-between">
        <span className="flex flex-col">
          {q.perMealPaise != null && (
            <span className="tabular text-lg font-semibold text-ink">
              {formatPaise(q.perMealPaise)}
              <span className="text-xs font-normal text-ink-muted">/meal</span>
            </span>
          )}
          {/* The cadence the plan actually bills on — this said "/mo" for
              weekly and quarterly plans too (2026-09-06 audit). */}
          <span className="tabular text-xs text-ink-muted">{formatPaise(q.cycleTotalPaise)} {CYCLE_SUFFIX[q.cycle] ?? "per cycle"}</span>
        </span>
        {q.launchable ? (
          <span className="shrink-0 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-gold-ink">
            Select
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-line-strong px-6 py-2.5 text-sm font-semibold text-ink">
            Join the waitlist
          </span>
        )}
      </div>
    </Link>
  );
}
