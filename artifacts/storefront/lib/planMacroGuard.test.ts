// Clinical-plan macro guard — swap deviation warnings.
//
// The eight cases below are carried over verbatim in intent from the legacy
// SPA's suite (artifacts/tanmatra/src/lib/planMacroGuard.test.ts), so the port
// is provably behaviour-preserving on everything the SPA asserted. The
// incomplete-day block at the end is NEW: the storefront's MealPlanDay has
// optional slots where the SPA's were required, and that difference is the one
// place the two versions deliberately diverge.
//
//   cd artifacts/api-server && \
//     node --test --import tsx ../storefront/lib/planMacroGuard.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPlanDay, type MealPlan, type MealPlanDay, type MealPlanConstraints, type MealPlanSlotEntry } from "./mealPlanApi";
import {
  dayMacroTotals,
  isDayComplete,
  planDayMacroDeviations,
  planSwapWarning,
  swapMacroWarning,
} from "./planMacroGuard";

function slot(protein: number, calories: number): MealPlanSlotEntry {
  return { dishId: 1, slug: "d", name: "Dish", image: "", pricePaise: 0, calories, protein, carbs: 0, fat: 0 };
}

function day(b: [number, number], l: [number, number], d: [number, number]): MealPlanDay {
  return { date: "2026-01-01", breakfast: slot(b[0], b[1]), lunch: slot(l[0], l[1]), dinner: slot(d[0], d[1]) };
}

function constraints(protein: number | null, calories: number | null): MealPlanConstraints {
  return {
    dailyCalorieTarget: calories,
    dailyProteinTargetGrams: protein,
    weeklyBudgetPaise: null,
    maxRepetitionsPerDish: 2,
    allergens: [],
    dietaryStyle: null,
    spiceLevel: null,
    goal: null,
  };
}

describe("dayMacroTotals", () => {
  it("sums protein and calories across the three slots", () => {
    const totals = dayMacroTotals(day([30, 400], [40, 600], [26, 500]));
    assert.equal(totals.protein, 96);
    assert.equal(totals.calories, 1500);
  });
});

describe("planDayMacroDeviations", () => {
  it("is empty when every targeted macro is within 10%", () => {
    // 96g protein vs 100g target = -4%; 1500 kcal vs 1550 = -3.2%.
    const devs = planDayMacroDeviations(day([30, 400], [40, 600], [26, 500]), constraints(100, 1550));
    assert.deepEqual(devs, []);
  });

  it("flags a protein deficit beyond the threshold", () => {
    // 96g vs 117g target = -17.9% → flagged, under target.
    const devs = planDayMacroDeviations(day([30, 400], [40, 600], [26, 500]), constraints(117, null));
    assert.equal(devs.length, 1);
    assert.equal(devs[0]!.macro, "protein");
    assert.ok(devs[0]!.deviationPct < 0);
  });

  it("skips macros without a target — no deficit against a goal that does not exist", () => {
    const devs = planDayMacroDeviations(day([10, 400], [10, 600], [10, 500]), constraints(null, null));
    assert.deepEqual(devs, []);
  });

  it("treats a zero target as no target, not as an unreachable one", () => {
    // Guards the `> 0` check: without it this divides by zero and reports -Infinity%.
    const devs = planDayMacroDeviations(day([10, 400], [10, 600], [10, 500]), constraints(0, 0));
    assert.deepEqual(devs, []);
  });

  it("orders by worst deviation first", () => {
    // protein 30g vs 120 target = -75%; calories 1500 vs 1400 = +7.1% (within).
    const devs = planDayMacroDeviations(day([10, 500], [10, 500], [10, 500]), constraints(120, 1400));
    assert.equal(devs[0]!.macro, "protein");
  });
});

describe("swapMacroWarning", () => {
  it("returns null when the day stays on target", () => {
    assert.equal(swapMacroWarning(day([30, 400], [40, 600], [26, 500]), constraints(100, 1550)), null);
  });

  it("names the macro, direction and figures for a deficit", () => {
    const msg = swapMacroWarning(day([30, 400], [40, 600], [26, 500]), constraints(117, null));
    assert.equal(msg, "This swap leaves the day 18% under your protein target (96g of 117g).");
  });

  it("reports an overshoot as 'over'", () => {
    const msg = swapMacroWarning(day([100, 500], [100, 500], [100, 500]), constraints(150, null));
    assert.ok(msg?.includes("over your protein target"));
  });
});

// ── The storefront-only divergence ──────────────────────────────────────────

describe("an incomplete day is not judged", () => {
  const partial: MealPlanDay = { date: "2026-01-01", breakfast: slot(30, 400), lunch: slot(40, 600) };

  it("is not complete when a slot is missing", () => {
    assert.equal(isDayComplete(partial), false);
    assert.equal(isDayComplete(day([30, 400], [40, 600], [26, 500])), true);
  });

  it("reports NO deviation for a half-built day, however far off the total looks", () => {
    // 70g of a 117g target is -40% — comfortably past the threshold. Reporting
    // it would blame a missing dinner on the patient's protein intake, which is
    // a clinical claim the data does not support.
    assert.deepEqual(planDayMacroDeviations(partial, constraints(117, null)), []);
    assert.equal(swapMacroWarning(partial, constraints(117, null)), null);
  });

  it("still sums what IS there, so callers can show progress", () => {
    // dayMacroTotals stays honest and unguarded — only the JUDGEMENT is gated.
    assert.deepEqual(dayMacroTotals(partial), { protein: 70, calories: 1000 });
  });
});

describe("planSwapWarning", () => {
  const offTarget = day([30, 400], [40, 600], [26, 500]); // 96g protein
  const plan = {
    days: [day([39, 500], [39, 500], [39, 500]), offTarget], // day 0 = 117g, dead on
    constraints: constraints(117, null),
  } as unknown as MealPlan;

  it("names the day, so the claim cannot attach to the wrong one", () => {
    const msg = planSwapWarning(plan, 1);
    // The label itself comes from formatPlanDay — asserted by identity, not by
    // a pinned locale string, because ICU output varies across environments and
    // a hardcoded "Thu, 1 Jan" would fail for a reason unrelated to this code.
    assert.ok(msg?.startsWith(`${formatPlanDay("2026-01-01")} — `));
    assert.ok(msg?.includes("18% under your protein target"));
  });

  it("is null for a day that is on target", () => {
    assert.equal(planSwapWarning(plan, 0), null); // 117g of a 117g target
  });

  it("is null with no plan and with no remembered day", () => {
    assert.equal(planSwapWarning(null, 1), null);
    assert.equal(planSwapWarning(plan, null), null);
  });

  it("is null for an index the plan no longer holds, rather than throwing", () => {
    // A regenerated week can be shorter than the one the index was recorded
    // against. Reading past the end must not crash the planner.
    assert.equal(planSwapWarning(plan, 6), null);
    assert.equal(planSwapWarning(plan, -1), null);
  });
});
