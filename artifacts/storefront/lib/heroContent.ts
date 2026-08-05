/**
 * DTR (Dynamic Tailored Referral) hero copy, derived from the `tnm_ref`
 * attribution cookie.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * This function is called by `app/page.tsx`, which is a Server Component (it
 * awaits `cookies()`). It used to live in `components/landing/Section01ClinicalHero.tsx`,
 * which carries `"use client"` — so the built server bundle held only a client
 * reference to it, and calling it server-side threw:
 *
 *   Attempted to call deriveHeroContent() from the server but
 *   deriveHeroContent is on the client.
 *
 * which surfaced as a 500 on `/` in a production build. Dev never caught it.
 *
 * The derivation is pure — a cookie string in, copy out — and both sides need
 * it, so it belongs in neither boundary's file. Keep it that way: nothing here
 * may import a `"use client"` module, or the same failure comes back.
 */
// Relative, not "@/lib/format": lint:filecap blocks the path alias inside lib/
// because the bare node test runner cannot resolve it.
import { formatPaise } from "./format";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

export interface HeroContent {
  eyebrow: string;
  headline: string;
  blurb: string;
  badge: string | null;
}

/** Prices come from PLAN_PRICE_TABLE — never a literal in the copy. */
export function deriveHeroContent(refCookie?: string): HeroContent {
  const ref = (refCookie ?? "").toLowerCase();
  const basePrice = formatPaise(PLAN_PRICE_TABLE.desk_fuel.veg.perMealPaise!);

  if (ref.startsWith("rd_") || ref.startsWith("dietitian_") || ref.includes("diet") || ref.includes("clinic") || ref.startsWith("dr_")) {
    return {
      eyebrow: "Referred by your Registered Dietitian",
      headline: "Expert-designed meals, cooked fresh — delivered straight to your desk.",
      blurb: `Formulated to align strictly with your health goals. Zero low-quality oils, precisely measured ingredients. Starting from ${basePrice} per meal.`,
      badge: "Priority Health Plan",
    };
  }

  if (ref.startsWith("gym_") || ref.startsWith("trainer_") || ref.includes("fit") || ref.includes("gym") || ref.startsWith("coach_")) {
    return {
      eyebrow: "Referred by your Fitness Club & Trainer",
      headline: "High-protein recovery meals, cooked fresh — delivered to your office or gym.",
      blurb: `Designed for muscle growth and steady energy with high-quality protein and healthy carbs. Starting from ${basePrice} per meal.`,
      badge: "Workout Recovery Plan",
    };
  }

  return {
    eyebrow: "Metabolic Precision",
    headline: "Personalized Nutrition — for Peak Metabolism",
    blurb: `Engineered around your biological footprint. 100% RD-backed metabolic food plans formulated for glycemic stability, gut resilience, and peak physical recovery. Starting from ${basePrice} per meal.`,
    badge: null,
  };
}
