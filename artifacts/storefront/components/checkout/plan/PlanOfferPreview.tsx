import Image from "next/image";
import { formatMacroLine, formatPaise } from "@/lib/format";
import { PLAN_DELIVERY_DAYS_SENTENCE, PLAN_DELIVERY_WINDOW_LABEL } from "@/lib/planCheckout";
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
 * T-16: each dish is a full row — 40px photo, a name allowed two lines, macros
 * in tabular figures — not one ellipsised line. For a ₹399 product whose whole
 * promise is three specific lunches, every name has to be readable at 393px.
 *
 * Presentational and hook-free by design. Its parent is a client component, so
 * this ships to the browser with it; keeping it stateless keeps that cheap.
 */
export function PlanOfferPreview({ offer }: { offer: PlanOffer }) {
  const cadence = CADENCE_LABEL[offer.cadence] ?? offer.cadence;
  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
      aria-label="What this plan includes"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-muted">
          <span className="font-display text-lg font-semibold leading-tight text-primary">{offer.mealsPerCycle} lunches</span> · {cadence}
        </span>
        <span className="font-data text-lg font-bold text-primary">
          {formatPaise(offer.cycleTotalPaise)}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink-muted">
        Delivered {PLAN_DELIVERY_DAYS_SENTENCE}, {PLAN_DELIVERY_WINDOW_LABEL}.
      </p>

      {offer.dishes.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
            {offer.cadence === "one_off" ? "Your three lunches" : "Dishes in this rotation"}
          </h3>
          <ul className="flex flex-col divide-y divide-line" data-testid="plan-offer-dishes">
            {offer.dishes.map((d) => (
              <li key={d.slug} className="flex min-h-11 items-center gap-3 py-2">
                {d.image && (
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-raised">
                    <Image src={d.image} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                )}
                <span className="min-w-0 flex-1 text-sm leading-snug text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {d.name}
                </span>
                {d.macros && (
                  <span className="tabular shrink-0 text-xs text-ink-faint">
                    {formatMacroLine(d.macros, d.macrosEstimated)}
                  </span>
                )}
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
