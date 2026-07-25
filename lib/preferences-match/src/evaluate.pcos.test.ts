import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDishForPreferences } from "./index";
import type { DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "./index";

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
    macros: { protein: 25, carbs: 40, fat: 12, fiber: 6, calories: 400 },
    ingredients: [],
    allergens: [],
    glycaemicIndex: "low",
    sugarPerServing: "5g",
    customizations: [],
    isAvailable: true,
    ...partial,
  } as DishData;
}

const pcosPrefs: PreferencesForMatch = {
  allergens: [],
  dislikedIngredients: [],
  cuisines: [],
  dietaryStyle: "omnivore",
  medicalConditions: [],
  pcosHistory: true,
};

test("PCOS gate blocks high glycaemic index dish", () => {
  const r = evaluateDishForPreferences(
    dish({ glycaemicIndex: "high", name: "White Rice & Curry" }),
    pcosPrefs,
    { strict: false }
  );
  assert.ok(r.matchedContraindications.includes("pcos"), "Should identify pcos contraindication");
  assert.ok(
    r.blockReasons.some(
      (b) => b.code === "contraindication_block" && b.detail.includes("High glycaemic index dish is contraindicated for PCOS")
    ),
    "Should include specific PCOS warning reason in blockReasons"
  );
});

test("PCOS gate blocks dish with high sugar content", () => {
  const r = evaluateDishForPreferences(
    dish({ sugarPerServing: "15g", glycaemicIndex: "medium" }),
    { ...pcosPrefs, medicalConditions: ["pcos"], pcosHistory: null },
    { strict: false }
  );
  assert.ok(r.matchedContraindications.includes("pcos"));
  assert.ok(
    r.blockReasons.some(
      (b) => b.code === "contraindication_block" && b.detail.includes("High sugar content")
    ),
    "Should flag high sugar content for PCOS in blockReasons"
  );
});

test("PCOS gate allows high-protein low-GI nutritional profile", () => {
  const r = evaluateDishForPreferences(
    dish({ glycaemicIndex: "low", sugarPerServing: "3g" }),
    pcosPrefs,
    { strict: false }
  );
  assert.equal(r.matchedContraindications.includes("pcos"), false);
});
