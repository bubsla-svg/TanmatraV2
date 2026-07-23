import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import type { PlanId } from "@workspace/subscription-rules";

/**
 * Plan surface card (02f §2). Server component. A launchable plan links into
 * its builder; a blocked plan (empty pool / pending SKUs) routes to waitlist
 * capture instead — never a dead end (02d §8). Prices are spine-quoted.
 */
export function PlanCard({ id }: { id: PlanId }) {
  const d = planDisplay(id);
  const q = planQuoteView(id);
  const href = q.launchable ? `/plan/${id}` : `/plan/${id}?waitlist=1`;

  const price =
    q.perMealPaise != null
      ? `${formatPaise(q.perMealPaise)}/meal · ${formatPaise(q.cycleTotalPaise)}/mo`
      : `${formatPaise(q.cycleTotalPaise)}/mo`;

  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-xl border bg-surface p-5 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
      style={{ borderColor: q.launchable ? "var(--line-strong)" : "var(--line)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{d.name}</h3>
        {d.clinical && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage-text ring-1 ring-sage/40">
            RD-reviewed
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{d.subtitle}</p>

      <div className="mt-auto flex items-end justify-between pt-2">
        <span className="tabular text-sm font-semibold text-ink">{price}</span>
        {q.launchable ? (
          <span className="text-sm font-semibold text-gold-text">Choose &rarr;</span>
        ) : (
          <span className="text-xs font-medium text-ink-faint">Join waitlist &rarr;</span>
        )}
      </div>
    </Link>
  );
}
