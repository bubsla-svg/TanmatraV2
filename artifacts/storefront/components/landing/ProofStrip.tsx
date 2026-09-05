import React from "react";
import type { LandingIconName } from "@/content/landing/partners";
import { LandingIcon } from "./LandingIcon";

export interface ProofItem {
  icon?: LandingIconName;
  value?: string;
  label: string;
}

export interface ProofStripProps {
  items: ProofItem[];
  heading?: string;
}

/**
 * Social proof & trust badge strip (L-1). Displays credentials, compliance ratings,
 * and satisfaction figures across landing page surfaces using canonical semantic tokens.
 * Kept strictly well under 150 lines per component budget rules.
 */
export function ProofStrip({ items, heading }: ProofStripProps) {
  return (
    <section className="border-y border-line bg-surface py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {heading && (
          <h2 className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {heading}
          </h2>
        )}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {items.map((item, idx) => (
            <div key={`${item.label}-${idx}`} className="flex flex-col items-center text-center">
              {item.icon && (
                <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-secondary text-sage">
                  <LandingIcon name={item.icon} className="h-5 w-5" />
                </div>
              )}
              {item.value && (
                <span className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  {item.value}
                </span>
              )}
              <span className="mt-1 text-xs text-ink-muted leading-snug">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
