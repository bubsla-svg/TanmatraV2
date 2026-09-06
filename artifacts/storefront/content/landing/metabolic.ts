/**
 * `/metabolic` copy + config — ported from the legacy app
 * (artifacts/tanmatra src/components/landing/MetabolicLandingView.tsx),
 * route-parity Wave B. Urban-professional fat-loss / muscle-gain acquisition
 * page with a goal toggle.
 *
 * IMPORTANT (money-path + model): the legacy page drove its plan sections off
 * the DEPRECATED `RD_PLANS` static data (per-week prices). The storefront's
 * authoritative plan spine is `@workspace/subscription-rules` `PLAN_CATALOG`
 * (server-priced, per-meal) surfaced by `lib/plans.ts`. So each goal maps to a
 * REAL PlanId — `steady` (low-GI, RD-reviewed) for fat loss, `protein_build`
 * for muscle — and the page renders `PlanCard` (server-authoritative pricing).
 * No price is fabricated here.
 *
 * COMPLIANCE (§7.2/§7.6): measurable-nutrient claims with numbers + process
 * claims about the kitchen — never disease/outcome claims. Copy kept verbatim
 * where the legacy claim survives the model change; plan-specific numbers that
 * lived only in RD_PLANS are dropped rather than re-invented.
 */
import type { PlanId } from "@workspace/subscription-rules";
import type { LandingBenefit } from "./partners";
import type { FaqItem } from "@/content/faq";

export const METABOLIC_META = {
  title: "Metabolic Meal Programs — Fat Loss & Lean Muscle | Tanmatra",
  description:
    "Fat-loss and muscle-gain meal programs for Noida professionals. Published macros on every dish, fired after you order and delivered hot.",
};

export const METABOLIC_HERO = {
  eyebrow: "Noida tech corridor · fresh-fired",
  title: "Your macros, engineered.",
  accent: "Your lunch, fired to order.",
  subtitle:
    "Two programs — low-GI Steady and high-protein Protein Build — cooked in our ISO 22000:2018 kitchen only after you order.",
};

export type GoalId = "fat_loss" | "muscle_gain";
/** Which live-catalog filter the explorer applies for a goal. */
export type GoalFilter = "low_gi_fiber" | "high_protein";

export interface MetabolicGoal {
  id: GoalId;
  label: string;
  icon: "scale" | "dumbbell";
  /** The REAL storefront plan this goal maps to (authoritative pricing). */
  planId: PlanId;
  weekOneSub: string;
  filter: GoalFilter;
}

export const GOALS: MetabolicGoal[] = [
  {
    id: "fat_loss",
    label: "Fat loss",
    icon: "scale",
    planId: "steady",
    weekOneSub:
      "Low-GI, fibre-forward plates from the live rotation — portioned so the afternoon stays sharp.",
    filter: "low_gi_fiber",
  },
  {
    id: "muscle_gain",
    label: "Muscle gain",
    icon: "dumbbell",
    planId: "protein_build",
    weekOneSub:
      "The highest-protein dishes in the live rotation — every gram printed on the label.",
    filter: "high_protein",
  },
];

/** The two programs shown, in order. Kept as PlanIds so PlanCard quotes them. */
export const METABOLIC_PLAN_IDS: PlanId[] = ["steady", "protein_build"];

export const PAIN_CARDS: LandingBenefit[] = [
  {
    icon: "fork-knife",
    title: "Cafeteria roulette",
    body: "The food court decides your macros for you. Paneer swimming in cream one day, a dry salad the next — no numbers on either.",
  },
  {
    icon: "lightning",
    title: "The 6 PM energy crash",
    body: "A heavy, high-GI lunch at 1 PM shows up as a meeting you can barely sit through at 6. Low-GI plates flatten that curve.",
  },
  {
    icon: "clipboard",
    title: "Protein you can’t verify",
    body: "A “high-protein bowl” with no label is a guess, not a plan. Every Tanmatra dish publishes protein, carbs, fat and its GI band.",
  },
];

export const METABOLIC_FAQ: FaqItem[] = [
  {
    q: "How do you verify macros?",
    a: "Every dish ships with a per-dish nutrition label. Macros are ingredient-derived, lab-informed estimates — and when a value is provisional, we label it provisional.",
  },
  {
    q: "Can I switch between fat loss and muscle gain?",
    a: "Yes. Programs run week to week — switch programs or swap any dish before it’s cooked, and your plan updates with it. No lock-in.",
  },
  {
    q: "Are there vegetarian options?",
    a: "Most programs offer veg, egg, and non-veg tracks — the plan builder shows each plan’s available tracks before you commit.",
  },
  {
    q: "When do meals arrive?",
    a: "Fired in our Sector 104 kitchen only after you order, sealed hot, and brought straight to you inside our Noida service zones — never a morning cold-drop.",
  },
];
