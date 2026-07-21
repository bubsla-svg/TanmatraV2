// Unit tests for the clinical-plan macro guard (swap deviation warnings).
//
// Run with the api-server's tsx loader (this package has no wired `test`
// script — mirrors rdPlans.pricing.test.ts):
//
//   cd artifacts/api-server && \
//   node --test --import tsx ../tanmatra/src/lib/planMacroGuard.test.ts
import { describe, it } from "node:test";
import assert from "node:assert";
import type { MealPlanDay, MealPlanConstraints, MealPlanSlotEntry } from "./mealPlanApi";
import {
  dayMacroTotals,
  planDayMacroDeviations,
  swapMacroWarning,
} from "./planMacroGuard";

function slot(protein: number, calories: number): MealPlanSlotEntry {
  return {
    dishId: 1,
    slug: "d",
    name: "Dish",
    image: "",
    pricePaise: 0,
    calories,
    protein,
    carbs: 0,
    fat: 0,
  };
}

function day(
  b: [number, number],
  l: [number, number],
  d: [number, number],
): MealPlanDay {
  return {
    date: "2026-01-01",
    breakfast: slot(b[0], b[1]),
    lunch: slot(l[0], l[1]),
    dinner: slot(d[0], d[1]),
  };
}

function constraints(
  protein: number | null,
  calories: number | null,
): MealPlanConstraints {
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
    assert.equal(devs[0].macro, "protein");
    assert.ok(devs[0].deviationPct < 0);
  });

  it("skips macros without a target", () => {
    const devs = planDayMacroDeviations(day([10, 400], [10, 600], [10, 500]), constraints(null, null));
    assert.deepEqual(devs, []);
  });

  it("orders by worst deviation first", () => {
    // protein 30g vs 120 target = -75%; calories 1500 vs 1400 = +7.1% (within).
    const devs = planDayMacroDeviations(day([10, 500], [10, 500], [10, 500]), constraints(120, 1400));
    assert.equal(devs[0].macro, "protein");
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
    // 300g protein vs 150 target = +100%.
    const msg = swapMacroWarning(day([100, 500], [100, 500], [100, 500]), constraints(150, null));
    assert.ok(msg && msg.includes("over your protein target"));
  });
});
