import { formatMacroLine, formatPaise } from "@/lib/format";
import { PLAN_DELIVERY_DAYS_LABEL, PLAN_DELIVERY_WINDOW_LABEL } from "@/lib/planCheckout";
import type { PlanOffer } from "@/lib/planOffer";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "billed weekly",
  fortnightly: "billed fortnightly",
  monthly: "billed monthly",
  quarterly: "billed quarterly",
  // A single charge with no renewal — never "billed …", which would contradict
  // the trial's own no-auto-convert promise two screens later.
  one_off: "one-time",
};

/**
 * Show first, ask second (Laws 1, 8).
 *
 * This renders ABOVE the serviceability gate — before the first question of
 * any kind. What it states is exactly what the plan does: the dishes its own
 * rotation contains with their own macros, the days and window the create call
 * books, and the spine's price for the selection the customer arrived with.
 *
 * Presentational and hook-free by design. Its parent is a client component, so
 * this ships to the browser with it; keeping it stateless keeps that cheap.
 */
export function PlanOfferPreview({ offer }: { offer: PlanOffer }) {
  const cadence = CADENCE_LABEL[offer.cadence] ?? offer.cadence;
  return (
    <section
      className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5"
      aria-label="What this plan includes"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">
          {offer.mealsPerCycle} lunches <span className="font-normal text-ink-muted">· {cadence}</span>
        </span>
        <span className="tabular text-lg font-semibold text-ink">
          {formatPaise(offer.cycleTotalPaise)}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink-muted">
        Delivered {PLAN_DELIVERY_DAYS_LABEL.toLowerCase()}, {PLAN_DELIVERY_WINDOW_LABEL}.
      </p>

      {offer.dishes.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Dishes in this rotation
          </h3>
          <ul className="flex flex-col gap-1.5">
            {offer.dishes.map((d) => (
              <li key={d.slug} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{d.name}</span>
                <span className="tabular shrink-0 text-xs text-ink-faint">
                  {formatMacroLine(d.macros, d.macrosEstimated)}
                </span>
              </li>
            ))}
          </ul>
          {offer.more > 0 && (
            <p className="text-xs text-ink-faint">
              …and {offer.more} more in the rotation.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
