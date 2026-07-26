"use client"; // Interactive click event tracking and sticky bottom conversion bar

import React from "react";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

/**
 * §11: Sticky Bottom Conversion Bar.
 * Ensures persistent, friction-free access to the interactive clinical assessment triage
 * across all mobile and desktop viewport depths.
 */
export function Section11StickyBottomBar() {
  const deskFuelBase = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

  const handleCtaClick = () => {
    emitLpEvent("sticky_cta_click", { page: "/", label: "Start Assessment Bottom" });
    window.dispatchEvent(new Event("open_tanmatra_assessment"));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3.5 backdrop-blur-md shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex-1 truncate">
          <p className="truncate text-sm font-bold text-ink">
            Tanmatra Clinical Nutrition
          </p>
          <p className="truncate text-xs text-ink-muted">
            RD-verified desk lunches starting from <span className="tabular font-semibold text-ink">{deskFuelBase}/meal</span> in Noida.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCtaClick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-[var(--gold-ink)] shadow-sm transition-transform active:scale-95 sm:text-sm sm:px-6 sm:py-3"
        >
          Start Assessment
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </div>
  );
}
