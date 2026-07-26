import React from "react";
import { formatPaise } from "@/lib/format";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

/**
 * §8: Pricing Transparency Strip.
 * Provides unambiguous, authoritative pricing schedules derived directly from
 * system calculation rules with zero hidden delivery surcharges or price literals.
 */
export function Section08PricingStrip() {
  const deskFuelMeal = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);
  const deskFuelMonth = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.monthlyTotalPaise!);
  
  const proteinMeal = formatPaise(PLAN_PRICE_TABLE.protein_build.veg.perMealPaise!);
  const proteinMonth = formatPaise(PLAN_PRICE_TABLE.protein_build.veg.monthlyTotalPaise!);

  const steadyMeal = formatPaise(PLAN_PRICE_TABLE.steady.nonveg.perMealPaise!);
  const steadyMonth = formatPaise(PLAN_PRICE_TABLE.steady.nonveg.monthlyTotalPaise!);

  const trialFlat = formatPaise(PLAN_PRICE_TABLE.trial_3day.one_off.flatPricePaise!);

  const pricingSchedules = [
    { title: "Desk Fuel (Veg Base)", perMeal: deskFuelMeal, cycleTotal: deskFuelMonth, note: "22 lunch cadence · zero delivery fee above threshold" },
    { title: "Protein Build (Veg Base)", perMeal: proteinMeal, cycleTotal: proteinMonth, note: "22 lunch cadence · high biological value protein" },
    { title: "Steady Clinical Track", perMeal: steadyMeal, cycleTotal: steadyMonth, note: "22 meal cadence · targeted low glycemic curve" },
    { title: "3-Day Introductory Trial", perMeal: trialFlat, cycleTotal: trialFlat, note: "All-inclusive 3-day verification package · one-off" },
  ];

  return (
    <section id="pricing" className="border-t border-line bg-surface-subtle py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            No Hidden Fees
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            Authoritative &amp; Transparent Price Schedule
          </h2>
          <p className="mt-3 text-sm text-ink-muted sm:text-base">
            All rates derived from our unified server pricing catalog. 5% GST included on meals, zero surprise surge pricing.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pricingSchedules.map((schedule, idx) => (
            <div key={idx} className="flex flex-col justify-between rounded-xl border border-line bg-surface p-6 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-ink">{schedule.title}</h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="tabular text-2xl font-extrabold text-ink">{schedule.perMeal}</span>
                  <span className="text-xs font-medium text-ink-faint">/meal rate</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-ink-muted">
                  Cycle total: <span className="tabular text-ink">{schedule.cycleTotal}</span>
                </div>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
                {schedule.note}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs font-medium text-ink-faint">
          Delivery waivers apply to eligible Noida commercial park sectors. Pause/resume credits accounted per paise.
        </p>
      </div>
    </section>
  );
}
