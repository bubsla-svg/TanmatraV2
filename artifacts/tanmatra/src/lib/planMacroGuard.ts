/**
 * Clinical-plan macro guard.
 *
 * When a user on a clinical meal plan swaps a slot, the new day may fall short
 * of (or overshoot) the plan's prescribed daily macro targets. A silent green
 * "success" toast hides that from the patient. These pure helpers compute the
 * day's macro totals against the plan's set targets so the swap handler can
 * escalate to an amber warning when the day drifts more than the allowed
 * threshold — the difference between "done" and "done, but you're now short on
 * protein".
 *
 * Only macros with a target set on the plan are evaluated; you cannot measure a
 * deficit against a goal that doesn't exist.
 */
import type { MealPlanDay, MealPlanConstraints } from "./mealPlanApi";

/** A swap is flagged once a targeted macro drifts more than 10% from target. */
export const MACRO_DEVIATION_THRESHOLD = 0.1;

export interface MacroDeviation {
  macro: "protein" | "calories";
  label: string;
  unit: string;
  target: number;
  actual: number;
  /** Signed fraction: negative = under target (a deficit), positive = over. */
  deviationPct: number;
}

/** Sum the three slots of a day for the macros a clinical plan targets. */
export function dayMacroTotals(day: MealPlanDay): { calories: number; protein: number } {
  const slots = [day.breakfast, day.lunch, day.dinner];
  return {
    calories: slots.reduce((sum, slot) => sum + (slot?.calories ?? 0), 0),
    protein: slots.reduce((sum, slot) => sum + (slot?.protein ?? 0), 0),
  };
}

/**
 * Targeted macros whose day total deviates from the plan's daily target by more
 * than MACRO_DEVIATION_THRESHOLD, worst deviation first. Untargeted macros
 * (null / 0) are skipped.
 */
export function planDayMacroDeviations(
  day: MealPlanDay,
  constraints: MealPlanConstraints,
): MacroDeviation[] {
  const totals = dayMacroTotals(day);
  const candidates: Array<Omit<MacroDeviation, "deviationPct">> = [];

  if (constraints.dailyProteinTargetGrams && constraints.dailyProteinTargetGrams > 0) {
    candidates.push({
      macro: "protein",
      label: "protein",
      unit: "g",
      target: constraints.dailyProteinTargetGrams,
      actual: totals.protein,
    });
  }
  if (constraints.dailyCalorieTarget && constraints.dailyCalorieTarget > 0) {
    candidates.push({
      macro: "calories",
      label: "calories",
      unit: " kcal",
      target: constraints.dailyCalorieTarget,
      actual: totals.calories,
    });
  }

  return candidates
    .map((c) => ({ ...c, deviationPct: (c.actual - c.target) / c.target }))
    .filter((c) => Math.abs(c.deviationPct) > MACRO_DEVIATION_THRESHOLD)
    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
}

/**
 * Warning copy for the worst macro deviation, or null when the day stays within
 * threshold on every targeted macro (the caller then shows a normal success).
 *   → "This swap leaves the day 18% under your protein target (96g of 117g)."
 */
export function swapMacroWarning(
  day: MealPlanDay,
  constraints: MealPlanConstraints,
): string | null {
  const worst = planDayMacroDeviations(day, constraints)[0];
  if (!worst) return null;
  const pct = Math.round(Math.abs(worst.deviationPct) * 100);
  const direction = worst.deviationPct < 0 ? "under" : "over";
  const actual = Math.round(worst.actual);
  const target = Math.round(worst.target);
  return `This swap leaves the day ${pct}% ${direction} your ${worst.label} target (${actual}${worst.unit} of ${target}${worst.unit}).`;
}
