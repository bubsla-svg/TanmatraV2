/**
 * Which menu goal filter a plan's promise corresponds to (T-15).
 *
 * A goal card used to have one door — the plan builder. "See meals" needs a
 * second door into /menu already narrowed to the dishes that serve the same
 * goal, and the mapping is a data fact, so it lives here where the test can
 * pin it. A plan with no honest goal filter gets none — no invented link.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import type { GoalFilter } from "./menuFilters";

const PLAN_GOAL: Record<string, GoalFilter> = {
  desk_fuel: "fat_loss",
  steady: "glucose_steady",
  glp1_companion: "glucose_steady",
  protein_build: "high_protein",
};

export function goalFilterForPlan(planId: string): GoalFilter | null {
  return PLAN_GOAL[planId] ?? null;
}

/** `/menu?goal=…` for a plan, or null when there is nothing honest to link. */
export function menuHrefForPlan(planId: string): string | null {
  const goal = goalFilterForPlan(planId);
  return goal ? `/menu?goal=${goal}` : null;
}
