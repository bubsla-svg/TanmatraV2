import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDishForPreferences } from "./index";
import type { DishData, PreferencesForMatch } from "./index";

function prefs(partial: Partial<PreferencesForMatch>): PreferencesForMatch {
  return {
    allergens: [],
    dislikedIngredients: [],
    cuisines: [],
    dietaryStyle: "omnivore",
    ...partial,
  };
}

function dish(partial: Partial<DishData>): DishData {
  return {
    id: 1,
    slug: "x",
    name: "X",
    description: "",
    longDescription: "",
    image: "",
    price: 0,
    kitchen: "continental",
    category: "mains",
    isVeg: true,
    rdVerified: true,
    prepTime: "",
    macros: { protein: 10, carbs: 10, fat: 5, fiber: 2, calories: 200 },
    ingredients: [],
    allergens: [],
    glycaemicIndex: "low",
    sugarPerServing: "",
    customizations: [],
    isAvailable: true,
    ...partial,
  } as DishData;
}

test("strict gate blocks a dish with unresolved (provisional) macros", () => {
  const r = evaluateDishForPreferences(dish({ macrosProvisional: true }), null, {
    strict: true,
  });
  assert.equal(r.blocked, true);
  assert.ok(r.blockReasons.some((b) => b.code === "macros_pending"));
});

test("soft (browse) mode with no declared preferences does not hard-block a provisional dish", () => {
  const r = evaluateDishForPreferences(dish({ macrosProvisional: true }), null);
  assert.equal(r.blocked, false);
});

test("a provisional dish is blocked (even outside strict) when the buyer has declared allergens", () => {
  const r = evaluateDishForPreferences(
    dish({ macrosProvisional: true }),
    prefs({ allergens: ["Peanuts"] }),
  );
  assert.equal(r.blocked, true);
  assert.ok(r.blockReasons.some((b) => b.code === "macros_pending"));
});

test("a provisional dish is blocked (even outside strict) when the buyer has a medical condition", () => {
  const r = evaluateDishForPreferences(
    dish({ macrosProvisional: true }),
    prefs({ medicalConditions: ["diabetes"] }),
  );
  assert.equal(r.blocked, true);
});

test("a resolved (non-provisional) dish is never caught by the macros_pending gate", () => {
  const r = evaluateDishForPreferences(dish({ macrosProvisional: false }), null, {
    strict: true,
  });
  assert.equal(
    r.blockReasons.some((b) => b.code === "macros_pending"),
    false,
  );
});
