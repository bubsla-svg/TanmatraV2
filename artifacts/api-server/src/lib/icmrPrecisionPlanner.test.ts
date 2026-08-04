import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateBmr,
  calculateTdee,
  calculateMacroTargets,
  generatePrecisionPlanLogic,
  type PrecisionPlannerInput,
} from "./icmrPrecisionPlanner";

test("calculateBmr produces correct Mifflin-St Jeor values", () => {
  // Male: 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75 -> 1649
  const maleBmr = calculateBmr(70, 175, 30, "male");
  assert.equal(maleBmr, 1649);

  // Female: 10*60 + 6.25*160 - 5*25 - 161 = 600 + 1000 - 125 - 161 = 1314
  const femaleBmr = calculateBmr(60, 160, 25, "female");
  assert.equal(femaleBmr, 1314);
});

test("calculateTdee applies activity multipliers", () => {
  const bmr = 1600;
  assert.equal(calculateTdee(bmr, "sedentary"), 1920);
  assert.equal(calculateTdee(bmr, "moderate"), 2480);
});

test("calculateMacroTargets shifts target calories and macros based on goal and diet", () => {
  const tdee = 2000;
  
  // Fat loss -> 80% calories (1600)
  const fatLoss = calculateMacroTargets(tdee, "fat_loss", "any");
  assert.equal(fatLoss.targetCalories, 1600);

  // Muscle gain -> 115% calories (2300)
  const muscleGain = calculateMacroTargets(tdee, "muscle_gain", "any");
  assert.equal(muscleGain.targetCalories, 2300);

  // Keto -> 70% Fat, 5% Carbs, 25% Protein
  const keto = calculateMacroTargets(tdee, "maintenance", "keto");
  assert.equal(keto.targetCarbsG, 25); // (2000 * 0.05) / 4 = 25g
});

test("generatePrecisionPlanLogic produces 7 daily Thalis with meals and totals", async () => {
  const input: PrecisionPlannerInput = {
    age: 28,
    gender: "female",
    heightCm: 165,
    weightKg: 62,
    activityLevel: "moderate",
    goal: "fat_loss",
    dietPreference: "veg",
    allergens: ["Nuts"],
  };

  const result = await generatePrecisionPlanLogic(input);

  assert.ok(result.bmr > 0);
  assert.ok(result.tdee > 0);
  assert.ok(result.targetCalories > 0);
  assert.equal(result.dailyThalis.length, 7);
  assert.ok(result.totalPlanPricePaise > 0);

  for (const thali of result.dailyThalis) {
    assert.equal(thali.meals.length, 3);
    assert.ok(thali.totals.calories > 0);
    assert.ok(thali.totals.pricePaise > 0);
  }
});
