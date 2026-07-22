// ─────────────────────────────────────────────────────────────────────────────
// Per-plan display copy for the 02f §2 plan surfaces (roadmap slice S7).
//
// INFERRED (per the "proceed on existing tokens" decision): the plan NAMES come
// from the corpus shared-numbers, but the one-line PROMISES (≤8 words) and the
// CHIP sets live in the absent Amendment 02 copy system. They are inferred here
// and flagged — reconcile when Amendment 02 lands (IMPLEMENTATION-PLAN S3).
// Prices are NOT inferred: they come from PLAN_CATALOG / computePlanQuote.
//
// `clinical` mirrors requiresRdSignoff (Steady, GLP-1) so those cards show the
// RD credibility beat (02d §6); it is derived, not inferred.
// ─────────────────────────────────────────────────────────────────────────────

import { PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import type { ChipGlyph, ChipTone } from "@/components/primitives";

export interface PlanChip {
  glyph: ChipGlyph;
  label: string;
  tone?: ChipTone;
}

export interface PlanDisplay {
  planId: PlanId;
  name: string;
  /** One-line promise, ≤8 words (INFERRED — Amendment 02 copy system). */
  promise: string;
  /** Up to 3 chips (02f §2.2). Goal glyph + one proof + (meal-card / RD). */
  chips: PlanChip[];
  /** Show the RD credibility beat — derived from requiresRdSignoff. */
  clinical: boolean;
}

const RAW: Record<PlanId, { name: string; promise: string; chips: PlanChip[] }> = {
  desk_fuel: {
    name: "Desk Fuel",
    promise: "Lunch that carries the workday", // INFERRED
    chips: [
      { glyph: "goal", label: "Workday" },
      { glyph: "meal_card", label: "Meal-card OK", tone: "sage" },
      { glyph: "calories", label: "300–650 kcal" },
    ],
  },
  steady: {
    name: "Steady",
    promise: "Keeps your sugar steady", // INFERRED
    chips: [
      { glyph: "low_gi", label: "Low-GI", tone: "sage" },
      { glyph: "meal_card", label: "Meal-card OK", tone: "sage" },
      { glyph: "rd_reviewed", label: "RD-signed", tone: "sage" },
    ],
  },
  glp1_companion: {
    name: "GLP-1 Companion",
    promise: "Made to work with your GLP-1", // INFERRED
    chips: [
      { glyph: "protein", label: "High-protein", tone: "protein" },
      { glyph: "rd_reviewed", label: "RD-signed", tone: "sage" },
    ],
  },
  protein_build: {
    name: "Protein Build",
    promise: "Built for muscle, minus the prep", // INFERRED
    chips: [
      { glyph: "protein", label: "≥28g protein", tone: "protein" },
      { glyph: "goal", label: "Muscle" },
      { glyph: "meal_card", label: "Meal-card OK", tone: "sage" },
    ],
  },
  teams: {
    name: "Teams",
    promise: "Lunch, handled for the whole office", // INFERRED
    chips: [
      { glyph: "goal", label: "For teams" },
      { glyph: "meal_card", label: "Meal-card OK", tone: "sage" },
    ],
  },
  trial_3day: {
    name: "3-Day Taste Test",
    promise: "Three lunches, one delivery-app price", // INFERRED
    chips: [],
  },
};

export const PLAN_DISPLAY: Record<PlanId, PlanDisplay> = Object.fromEntries(
  (Object.keys(RAW) as PlanId[]).map((id) => [
    id,
    {
      planId: id,
      name: RAW[id].name,
      promise: RAW[id].promise,
      chips: RAW[id].chips.slice(0, 3), // 02f §2.2 hard cap: 3 chips
      clinical: PLAN_CATALOG[id].requiresRdSignoff,
    },
  ]),
) as Record<PlanId, PlanDisplay>;

export function planDisplay(planId: PlanId): PlanDisplay {
  return PLAN_DISPLAY[planId];
}
