/**
 * Menu personalisation fit/rank — the safety-critical bit, so it's unit-tested
 * against the shared evaluator. Locks: an allergen conflict NAMES the specific
 * allergen ("Contains Peanuts"); a diet conflict names the diet reason;
 * best-fit sorts first and conflicts sink to the bottom (never hidden).
 * Run: node --test --import tsx ./lib/menuFit.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "@workspace/preferences-match";
import { computeDishFit, isMeaningful, rankDishes } from "./menuFit";

// Spread a real catalog dish for a complete, valid DishData, then override the
// handful of fields each case exercises. allergensReviewed/macrosProvisional
// are pinned so the strict-only gates never interfere with soft-mode scoring.
const BASE = DISHES[0]!;
function dish(overrides: Partial<DishData>): DishData {
  return {
    ...BASE,
    allergensReviewed: true,
    macrosProvisional: false,
    rdReviewState: "reviewed",
    contraindications: [],
    ...overrides,
  } as DishData;
}

function prefs(overrides: Partial<PreferencesForMatch>): PreferencesForMatch {
  return {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    goal: null,
    calorieTarget: null,
    medicalConditions: [],
    ...overrides,
  };
}

const mac = (calories: number, protein: number, carbs: number, fat: number) =>
  ({ ...BASE.macros, calories, protein, carbs, fat });

const PEANUT = dish({ id: 1, slug: "peanut-bowl", name: "Peanut Bowl", isVeg: true, allergens: ["peanuts"], ingredients: ["peanuts", "rice"], macros: mac(500, 20, 40, 20) });
const CHICKEN = dish({ id: 2, slug: "chicken", name: "Chicken Plate", isVeg: false, allergens: [], ingredients: ["chicken"], macros: mac(520, 40, 10, 25) });
const SALAD = dish({ id: 3, slug: "light-salad", name: "Light Salad", isVeg: true, allergens: [], ingredients: ["lettuce", "cucumber"], macros: mac(400, 22, 12, 8) });
const HEAVY = dish({ id: 4, slug: "heavy-bowl", name: "Heavy Bowl", isVeg: true, allergens: [], ingredients: ["rice", "paneer"], macros: mac(600, 20, 60, 20) });

test("allergen conflict NAMES the specific allergen the customer listed", () => {
  const fit = computeDishFit(PEANUT, prefs({ allergens: ["peanuts"] }));
  assert.equal(fit.band, "conflict");
  assert.equal(fit.conflictLabel, "Contains Peanuts");
});

test("multiple matched allergens are all named", () => {
  const dishTwo = dish({ id: 9, slug: "mix", name: "Mix", isVeg: true, allergens: ["peanuts", "soy"], ingredients: ["peanuts", "tofu"], macros: mac(500, 20, 30, 20) });
  const fit = computeDishFit(dishTwo, prefs({ allergens: ["peanuts", "soy"] }));
  assert.equal(fit.band, "conflict");
  assert.equal(fit.conflictLabel, "Contains Peanuts, Soy");
});

test("a dish with no listed-allergen match is NOT a conflict for that reason", () => {
  const fit = computeDishFit(SALAD, prefs({ allergens: ["peanuts"] }));
  assert.notEqual(fit.band, "conflict");
});

test("diet conflict names the diet reason, not an allergen", () => {
  const fit = computeDishFit(CHICKEN, prefs({ dietaryStyle: "vegetarian" }));
  assert.equal(fit.band, "conflict");
  assert.equal(fit.conflictLabel, "Not vegetarian");
});

test("a goal-matching dish with no warnings is a high fit", () => {
  const fit = computeDishFit(SALAD, prefs({ goal: "lose_weight" }));
  assert.equal(fit.band, "high");
  assert.equal(fit.conflictLabel, undefined);
});

test("rankDishes: best fit first, conflicts last, stable within a band", () => {
  const p = prefs({ allergens: ["peanuts"], goal: "lose_weight" });
  // PEANUT → conflict, SALAD (400 kcal) → high, HEAVY (600 kcal) → moderate.
  const ranked = rankDishes([PEANUT, HEAVY, SALAD], p);
  assert.deepEqual(ranked.map((r) => r.dish.id), [3, 4, 1]);
  assert.equal(ranked[0]!.fit.band, "high");
  assert.equal(ranked[2]!.fit.band, "conflict");
  assert.equal(ranked[2]!.fit.conflictLabel, "Contains Peanuts");
});

test("isMeaningful: an all-default profile is skipped; any real signal opts in", () => {
  assert.equal(isMeaningful(null), false);
  assert.equal(isMeaningful(prefs({})), false);
  assert.equal(isMeaningful(prefs({ allergens: ["peanuts"] })), true);
  assert.equal(isMeaningful(prefs({ dietaryStyle: "vegan" })), true);
  assert.equal(isMeaningful(prefs({ goal: "gain_muscle" })), true);
  assert.equal(isMeaningful(prefs({ goal: "maintain" })), false);
});
