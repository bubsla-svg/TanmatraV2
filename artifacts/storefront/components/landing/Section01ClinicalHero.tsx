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
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-10 sm:pb-14 lg:pt-12">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-sage-text">
              RD-Designed Daily Meals
            </span>
            <span className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
              Noida · Hot &amp; Fresh
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Therapeutic Nutrition. <br />
            <span className="text-gold-text">Crafted by Dietitians.</span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg lg:max-w-xl">
            Chef-prepared, macro-balanced meal plans customized for your health goals. Delivered daily right to your doorstep.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3.5 sm:mt-8">
            <button
              type="button"
              onClick={handleAssessmentClick}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-[var(--gold-ink)] shadow-lg transition-transform active:scale-[0.98]"
            >
              Start 60s Quiz &amp; Customize
              <span aria-hidden>&rarr;</span>
            </button>

            <Link
              href="/menu"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-5 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-surface active:scale-95"
            >
              Explore Today's Menu
            </Link>
          </div>

          {/* Clinical Authority Trust Bar */}
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line/80 pt-5 text-xs text-ink-muted">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sage-soft text-[10px] font-bold text-sage-text">✓</span>
              ISO 22000 Certified
            </div>
            <span className="text-line-strong">•</span>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sage-soft text-[10px] font-bold text-sage-text">✓</span>
              FSSAI Verified
            </div>
            <span className="text-line-strong">•</span>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sage-soft text-[10px] font-bold text-sage-text">✓</span>
              Dietitian Supervised
            </div>
          </div>
        </div>

        {/* Hero Visual Card */}
        <div className="relative lg:col-span-5">
          <div className="group relative overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-xl transition-all duration-300 hover:shadow-2xl">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <img
                src="/images/hero_wellness_bowl.jpg"
                alt="Wild Salmon & Quinoa Wellness Bowl"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              <span className="absolute top-3 left-3 rounded-full bg-neutral-900/80 px-3 py-1 text-xs font-bold text-gold backdrop-blur-md">
                ⭐ 4.9 · Today's Chef Feature
              </span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-ink sm:text-lg">Wild Salmon &amp; Tahini Power Bowl</h3>
                  <p className="text-xs text-ink-muted">480 kcal · 38g Protein · Anti-Inflammatory</p>
                </div>
                <Link
                  href="/menu"
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-[var(--gold-ink)] hover:brightness-105"
                >
                  Order Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
