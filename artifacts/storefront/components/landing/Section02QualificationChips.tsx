import React from "react";
import { formatPaise } from "@/lib/format";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

/**
 * §2: Qualification Chips Strip.
 * Highlights four critical pillars of Tanmatra's service: delivery speed, macro verification,
 * kitchen hygiene credentials, and authoritative baseline meal pricing.
 */
export function Section02QualificationChips() {
  const deskFuelBase = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

  const chips = [
    {
      value: "40–45m",
      label: "Fast Delivery in Noida",
    },
    {
      value: "100%",
      label: "Clean Ingredients, Healthy Fats",
    },
    {
      value: "FSSAI & ISO",
      label: "Certified Safe & Hygienic",
    },
    {
      value: `${deskFuelBase}/meal`,
      label: "Affordable Daily Options",
    },
  ];

  return (
    <section className="border-y border-line bg-surface-subtle py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {chips.map((chip, idx) => (
            <div
              key={`${chip.label}-${idx}`}
              className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-4 text-center shadow-sm"
            >
              <span className="tabular text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {chip.value}
              </span>
              <span className="mt-1.5 text-xs font-medium leading-snug text-ink-muted">
                {chip.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
