import React from "react";
import { formatPaise } from "@/lib/format";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

/**
 * §2: Qualification Chips Strip.
 * Highlights four critical pillars of Tanmatra's service: delivery speed, macro verification,
 * kitchen hygiene credentials, and authoritative baseline meal pricing.
 */
export function Section02QualificationChips() {
  const chips = [
    { label: "Metabolic Flex", icon: "bolt" },
    { label: "Glucose Stable", icon: "vital_signs" },
    { label: "Lipid Optimization", icon: "cardiology" },
    { label: "Hormonal Balance", icon: "balance" },
    { label: "Ketogenic Depth", icon: "local_fire_department" },
    { label: "Insulin Sensitivity", icon: "ecg" },
  ];

  return (
    <section className="border-y border-line bg-surface py-6">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6">
        <div className="flex gap-3.5 overflow-x-auto no-scrollbar py-2">
          {chips.map((chip, idx) => (
            <div
              key={`${chip.label}-${idx}`}
              className="flex-none px-6 py-2.5 rounded-full border border-line bg-surface-raised font-mono text-xs font-semibold text-ink-muted hover:text-primary hover:border-primary/40 transition-all cursor-default shadow-sm"
            >
              {chip.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
