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
