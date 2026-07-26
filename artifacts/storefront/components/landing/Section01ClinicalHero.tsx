"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { emitLpEvent } from "@/lib/lpEvents";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

export interface HeroContent {
  eyebrow: string;
  headline: string;
  blurb: string;
  badge: string | null;
}

/**
 * Derives personalized hero content from the tnm_ref attribution cookie (DTR).
 * Guarantees zero hardcoded price literals by reading PLAN_PRICE_TABLE from @workspace/subscription-rules.
 */
export function deriveHeroContent(refCookie?: string): HeroContent {
  const ref = (refCookie ?? "").toLowerCase();
  const basePrice = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

  if (ref.startsWith("rd_") || ref.startsWith("dietitian_") || ref.includes("diet") || ref.includes("clinic") || ref.startsWith("dr_")) {
    return {
      eyebrow: "Referred by your Registered Dietitian",
      headline: "Clinical meal prescription cooked fresh — verified macro precision at your desk.",
      blurb: `Formulated to align strictly with your dietitian's therapeutic nutritional targets. Zero industrial oils, weighed macro tolerances. Starting from ${basePrice} per meal.`,
      badge: "Clinical Adherence Priority",
    };
  }

  if (ref.startsWith("gym_") || ref.startsWith("trainer_") || ref.includes("fit") || ref.includes("gym") || ref.startsWith("coach_")) {
    return {
      eyebrow: "Referred by your Fitness Club & Trainer",
      headline: "Performance macro recovery cooked fresh — delivered straight to your office or gym.",
      blurb: `Engineered for peak hypertrophy and glycemic stability with lab-tested lean proteins and clean complex carbohydrates. Starting from ${basePrice} per meal.`,
      badge: "Performance Recovery Protocol",
    };
  }

  return {
    eyebrow: "Now serving Noida",
    headline: "Clinical nutrition, cooked fresh — at your desk in 40–45 minutes.",
    blurb: `RD-designed lunches with verified macros. Real food first, the science on the label. Starting from ${basePrice} per meal.`,
    badge: null,
  };
}

/**
 * §1: Clinical Hero with Pressure Valve to Desk Fuel.
 * Renders tailored DTR referral copy and conversion CTAs using semantic design tokens.
 */
export function Section01ClinicalHero({ hero }: { hero: HeroContent }) {
  const deskFuelPrice = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

  const handleHeroClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Explore Protocols Hero" });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16 lg:pt-16">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-sage-text sm:text-sm">
            {hero.eyebrow}
          </p>
          {hero.badge && (
            <span className="rounded-full border border-line bg-surface-raised px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-text">
              {hero.badge}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {hero.headline}
        </h1>

        <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-xl">
          {hero.blurb}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-10">
          <a
            href="#protocols"
            onClick={handleHeroClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-semibold text-[var(--gold-ink)] shadow-sm transition-transform active:scale-[0.98]"
          >
            Explore clinical protocols
            <span aria-hidden>&rarr;</span>
          </a>

          <Link
            href="/menu"
            className="inline-flex items-center justify-center rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-line-strong active:scale-95"
          >
            Pressure Valve: Quick Desk Fuel ({deskFuelPrice}/meal)
          </Link>
        </div>

        <p className="mt-4 text-xs font-medium text-ink-faint">
          Zero subscription lock-in. Immediate hot lunch delivery across Noida enterprise corridors.
        </p>
      </div>
    </section>
  );
}
