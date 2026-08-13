import React from "react";
import { PriceDisplay } from "./PriceDisplay";
import { PrimaryCTA } from "./CTA";

interface StickyLedgerProps {
  chargePaise: number;
  originalChargePaise?: number;
  ctaText: string;
  onCtaClick: () => void;
  disabled?: boolean;
  itemCount?: number;
}

export const StickyLedger: React.FC<StickyLedgerProps> = ({
  chargePaise,
  originalChargePaise,
  ctaText,
  onCtaClick,
  disabled = false,
  itemCount,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-6 py-4 shadow-2xl">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div>
          <PriceDisplay
            pricePaise={chargePaise}
            originalPricePaise={originalChargePaise}
            label={itemCount ? `Payable Today (${itemCount} meals)` : "Total Payable Today"}
            size="lg"
          />
          <p className="text-3xs text-slate-400 mt-0.5">Includes taxes & free delivery</p>
        </div>

        {/* Single Primary Gold CTA Contract */}
        <PrimaryCTA onClick={onCtaClick} disabled={disabled}>
          <span>{ctaText}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </PrimaryCTA>
      </div>
    </div>
  );
};
