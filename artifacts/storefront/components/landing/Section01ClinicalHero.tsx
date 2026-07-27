"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";
import type { HeroContent } from "@/lib/heroContent";

// deriveHeroContent used to live here. app/page.tsx is a Server Component and
// calls it, which a "use client" module cannot serve — it 500'd the homepage in
// a production build. It now lives in @/lib/heroContent; do not move it back.

/**
 * §1: Clinical Hero with Pressure Valve to Desk Fuel.
 * Renders tailored DTR referral copy and conversion CTAs using semantic design tokens.
 */
export function Section01ClinicalHero({ hero }: { hero: HeroContent }) {
  const deskFuelPrice = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

  const handleAssessmentClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Take Metabolic Assessment" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open_tanmatra_assessment"));
    }
  };

  const handleCorporateClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Subsidize Team Lunch" });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16 lg:pt-16">
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-sage-text sm:text-sm">
            Certified Healthy Kitchen · Noida
          </p>
          <span className="rounded-full border border-line bg-surface-raised px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-text">
            Temperature Controlled Delivery
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Take the Guesswork Out of <span className="text-gold-text">Healthy Eating.</span>
        </h1>

        <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-xl">
          Custom meal plans tailored to your health goals by Registered Dietitians. Fresh, verified, and delivered exactly when you need them.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-10">
          <button
            type="button"
            onClick={handleAssessmentClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-[var(--gold-ink)] shadow-md transition-transform active:scale-[0.98]"
          >
            Take the Metabolic Assessment
            <span aria-hidden>&rarr;</span>
          </button>

          <Link
            href="/corporate-wellness"
            onClick={handleCorporateClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gold-text bg-surface px-6 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-surface-raised active:scale-95"
          >
            Subsidize Your Team's Lunch
          </Link>
        </div>

        {/* Clinical Authority Trust Bar */}
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line/80 pt-6 text-xs text-ink-muted">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-soft text-sage-text font-bold text-[11px]">✓</span>
            ISO 22000:2018 Certified Kitchen
          </div>
          <span className="hidden sm:inline text-line-strong">•</span>
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-soft text-sage-text font-bold text-[11px]">✓</span>
            FSSAI Lic. 22725926001018
          </div>
          <span className="hidden sm:inline text-line-strong">•</span>
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-soft text-sage-text font-bold text-[11px]">✓</span>
            Supervised by Dr. Anjali Nair, RD
          </div>
        </div>
      </div>
    </section>
  );
}
