/**
 * Clinical-plan macro guard.
 *
 * When a user on a clinical meal plan swaps a slot, the new day may fall short
 * of (or overshoot) the plan's prescribed daily macro targets. A silent
 * "swapped ✓" refetch hides that from the patient. These pure helpers compute
 * the day's macro totals against the plan's set targets so the swap flow can
 * escalate to an amber warning when the day drifts more than the allowed
 * threshold — the difference between "done" and "done, but you're now short on
 * protein".
 *
 * Only macros with a target set on the plan are evaluated; you cannot measure a
 * deficit against a goal that does not exist.
 *
 * PORTED from the legacy SPA (`artifacts/tanmatra/src/lib/planMacroGuard.ts`),
 * where it was written, tested, and then orphaned when the customer routes were
 * removed on 2026-07-26 — the storefront has carried the swap flow ever since
 * with no guard behind it. See docs/LEGACY-SPA-DEAD-CODE.md.
 */
import { formatPlanDay, type MealPlan, type MealPlanDay, type MealPlanConstraints } from "./mealPlanApi";

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

const SLOTS = ["breakfast", "lunch", "dinner"] as const;

/**
 * THE ONE BEHAVIOURAL CHANGE FROM THE SPA VERSION, and it is forced by the
 * types. The SPA's `MealPlanDay` had all three slots REQUIRED; the storefront's
 * are optional ("a generated plan fills all 21, but render defensively" —
 * mealPlanApi.ts). Summing a day whose dinner has not arrived yields a low
 * total, and the guard would report "18% under your protein target" when the
 * real cause is that a slot is missing. That attributes a data-loading state to
 * a nutritional deficit — an unearned clinical claim, which is the exact class
 * of defect the macro-trust work exists to remove.
 *
 * So an incomplete day is not judged at all. This costs nothing in the flow it
 * guards: a swap REPLACES a slot, so a day being swapped is complete by
 * construction. It only suppresses nonsense on the defensive path.
 *
 * If per-day meal counts ever become a real plan option (a 2-meal plan, where
 * a missing dinner is the prescription rather than a gap), this is the line to
 * revisit — the daily target would then apply to however many slots exist.
 */
export function isDayComplete(day: MealPlanDay): boolean {
  return SLOTS.every((s) => day[s] != null);
}

/** Sum the three slots of a day for the macros a clinical plan targets. */
export function dayMacroTotals(day: MealPlanDay): { calories: number; protein: number } {
  return SLOTS.reduce(
    (totals, s) => {
      const slot = day[s];
      return {
        calories: totals.calories + (slot?.calories ?? 0),
        protein: totals.protein + (slot?.protein ?? 0),
      };
    },
    { calories: 0, protein: 0 },
  );
}

/**
 * Targeted macros whose day total deviates from the plan's daily target by more
 * than MACRO_DEVIATION_THRESHOLD, worst deviation first. Untargeted macros
 * (null / 0) are skipped, and so is an incomplete day (see `isDayComplete`).
 */
export function planDayMacroDeviations(
  day: MealPlanDay,
  constraints: MealPlanConstraints,
): MacroDeviation[] {
  if (!isDayComplete(day)) return [];

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

/**
 * The same warning for one day of a plan, prefixed with that day's label.
 *
 * The prefix is not cosmetic. The notice renders once, above a seven-day grid,
 * so unqualified copy ("the day") leaves the reader to guess which of the seven
 * it means — and a macro claim pinned to the wrong day is worse than no claim.
 *
 * Derived on every render rather than stored: it has to describe the day as it
 * is NOW, after the swap's refetch lands. An index the plan no longer holds
 * (shorter regenerated week, plan replaced underneath) yields null rather than
 * a reading of a day that isn't there.
 */
export function planSwapWarning(plan: MealPlan | null, dayIndex: number | null): string | null {
  if (!plan || dayIndex == null) return null;
  const day = plan.days[dayIndex];
  if (!day) return null;
  const warning = swapMacroWarning(day, plan.constraints);
  return warning && `${formatPlanDay(day.date)} — ${warning}`;
}
