import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import type { PlanId } from "@workspace/subscription-rules";

/**
 * Stitch-scoped plan card (route-05 redesign) — rendered by app/plans/page.tsx
 * ONLY. The shared PlanCard still serves /care, /metabolic and /protocol
 * unchanged; this variant exists so the /plans restyle can't repaint routes it
 * doesn't own. Behaviour is identical to PlanCard (02f §2): a launchable plan
 * links into its builder; a blocked plan (empty pool / pending SKUs) routes to
 * waitlist capture instead — never a dead end (02d §8). Prices are
 * spine-quoted (PLAN_PRICE_TABLE via planQuoteView) and rendered verbatim.
 */
export function PlanCardStitch({ id }: { id: PlanId }) {
  const d = planDisplay(id);
  const q = planQuoteView(id);
  const href = q.launchable ? `/plan/${id}` : `/plan/${id}?waitlist=1`;

  return (
    <Link
      href={href}
      className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-line-strong active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-semibold text-ink">{d.name}</h3>
          <p className="text-sm leading-relaxed text-ink-muted">{d.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {d.clinical && (
            <span className="rounded-full border border-line px-2.5 py-1 text-3xs font-semibold uppercase tracking-wide text-sage-text">
              RD-reviewed
            </span>
          )}
          {q.servedTracks.map((t) => (
            <span
              key={t}
              className="rounded-full border border-line px-2.5 py-1 text-3xs font-semibold uppercase tracking-wide text-ink-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        {q.perMealPaise != null && (
          <>
            <span className="tabular text-2xl text-ink">{formatPaise(q.perMealPaise)}</span>
            <span className="tabular text-sm text-ink-muted">/meal</span>
          </>
        )}
        <span className="ml-auto flex flex-col items-end">
          <span className="tabular text-sm text-ink">{formatPaise(q.cycleTotalPaise)}</span>
          <span className="text-3xs font-semibold uppercase tracking-wide text-ink-muted">/mo</span>
        </span>
      </div>

      {q.launchable ? (
        <span className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]">
          Select plan
        </span>
      ) : (
        <span className="inline-flex items-center justify-center rounded-full border border-line-strong px-5 py-3 text-sm font-semibold text-ink">
          Join waitlist &rarr;
        </span>
      )}
    </Link>
  );
}
