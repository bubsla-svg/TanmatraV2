import type { PlanId } from "@workspace/subscription-rules";

/**
 * The ONE display name each plan has, anywhere in the storefront.
 *
 * This copy used to live in `lib/plans.ts`, which imports the whole dish
 * catalog for its pool helpers — so any client component wanting a plan's name
 * had to drag 116 dishes into its bundle to get one string. Splitting the copy
 * out means a name costs a name. `lib/plans.ts` re-exports it, so every
 * existing consumer is unaffected.
 *
 * WHY THIS IS THE ONLY PLACE A PLAN MAY BE NAMED
 * ----------------------------------------------
 * The landing page sold "Weight-Loss Jumpstart", "PCOS Hormone Balance" and
 * "Lean Muscle Builder". Clicking any of them landed on "Desk Fuel", "Steady"
 * and "Protein Build" — same plans, different names, no explanation. The
 * assessment invented a third set ("Weight-Loss Jumpstart & Metabolic Reset
 * Protocol"), and a homepage rail invented a fourth ("Metabolic Reset").
 *
 * That is a conversion leak, not a copy nit: a buyer who picks a plan by name
 * cannot confirm they landed on the thing they chose, at the exact step where
 * they are deciding to pay. It is also a working-memory violation — the label
 * they memorised never reappears.
 *
 * So: surfaces render `planDisplay(id)`. A plan name written as a literal in a
 * component is a bug, and `planCopy.test.ts` fails the build on the four names
 * this fracture introduced.
 *
 * NOTE the separate, legitimate naming layer: PROTOCOL landers
 * (`content/landing/protocol.ts` — "Wellness / Clinical / Performance
 * Protocol") are editorial surfaces that each carry a `planId` pointing at one
 * of these plans. A protocol name is not a plan name; it is the name of the
 * page that sells one. Both may appear together as long as the plan's own name
 * is the one on the plan.
 */
export interface PlanDisplay {
  id: PlanId;
  name: string;
  /** Router answer / one-line promise (02 §3, 02e §2). */
  promise: string;
  /** Sensory-hook subtitle (INFERRED from 02 §3 — flagged). */
  subtitle: string;
  clinical: boolean;
}

export const PLAN_DISPLAY: Record<PlanId, PlanDisplay> = {
  desk_fuel: { id: "desk_fuel", name: "Desk Fuel", promise: "Get me through the workday", subtitle: "22 lunches that pull their weight.", clinical: false },
  steady: { id: "steady", name: "Steady", promise: "Keep my sugar steady", subtitle: "Low-GI builds, RD-reviewed — steady energy, steady sugar.", clinical: true },
  glp1_companion: { id: "glp1_companion", name: "GLP-1 Companion", promise: "I'm on a GLP-1", subtitle: "Small portions, serious protein — built for how you eat now.", clinical: true },
  protein_build: { id: "protein_build", name: "Protein Build", promise: "Build muscle", subtitle: "Protein-per-rupee that trains with you.", clinical: false },
  teams: { id: "teams", name: "Tanmatra for Teams", promise: "Feed the team", subtitle: "Desk-drop for 10+ seats, weekly invoice.", clinical: false },
  trial_3day: { id: "trial_3day", name: "3-Day Taste Test", promise: "Try a few days first", subtitle: "Three lunches, full creditback if you continue.", clinical: false },
};

export function planDisplay(id: PlanId): PlanDisplay {
  return PLAN_DISPLAY[id];
}
