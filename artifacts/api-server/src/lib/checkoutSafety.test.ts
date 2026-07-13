// Unit tests for the pure checkout-safety decisions (no DB required).
// Run: node --test --import tsx ./src/lib/checkoutSafety.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DishData } from "@workspace/menu-catalog";
import {
  assessAllergenAck,
  findDishSafetyBlock,
  normalizeGuestPrefs,
} from "./checkoutSafety.js";

function dish(overrides: Partial<DishData> = {}): DishData {
  return {
    id: 1,
    slug: "test-dish",
    name: "Test Dish",
    description: "d",
    longDescription: "Rice – 100 g",
    image: "",
    price: 10000,
    kitchen: "continental",
    category: "bowls",
    isVeg: true,
    rdVerified: true,
    prepTime: "10 min",
    macros: { protein: 8, carbs: 20, fat: 5, fiber: 4, calories: 200 },
    ingredients: ["Rice – 100 g"],
    allergens: [],
    glycaemicIndex: "low",
    sugarPerServing: "4g",
    customizations: [],
    isAvailable: true,
    ...overrides,
  };
}

test("normalizeGuestPrefs: undefined/null → null", () => {
  assert.equal(normalizeGuestPrefs(undefined), null);
  assert.equal(normalizeGuestPrefs(null), null);
});

test("normalizeGuestPrefs: fills defaults, dietaryStyle defaults to omnivore", () => {
  const p = normalizeGuestPrefs({ allergens: ["dairy"] });
  assert.deepEqual(p, {
    allergens: ["dairy"],
    dislikedIngredients: [],
    medicalConditions: [],
    cuisines: [],
    dietaryStyle: "omnivore",
  });
});

test("findDishSafetyBlock: reviewed dish + null prefs → clear (null)", () => {
  assert.equal(findDishSafetyBlock(dish(), null), null);
});

test("findDishSafetyBlock: unreviewed dish blocks a guest even with null prefs (RD-review gate)", () => {
  const reasons = findDishSafetyBlock(dish({ rdReviewState: "pending_review" }), null);
  assert.ok(reasons, "should block");
  assert.ok(reasons!.some((r) => r.code === "unreviewed_dish"));
});

test("findDishSafetyBlock: guest-declared dairy allergy blocks a dairy dish", () => {
  const prefs = normalizeGuestPrefs({ allergens: ["dairy"] });
  const reasons = findDishSafetyBlock(dish({ allergens: ["Dairy"] }), prefs);
  assert.ok(reasons, "should block");
  assert.ok(reasons!.some((r) => r.code === "allergen_block"));
});

test("findDishSafetyBlock: clean reviewed dish + omnivore guest → clear", () => {
  const prefs = normalizeGuestPrefs({ dietaryStyle: "omnivore" });
  assert.equal(findDishSafetyBlock(dish({ allergens: [] }), prefs), null);
});

test("assessAllergenAck: guest, no prefs, allergen dish, no ack → required", () => {
  const d = assessAllergenAck({
    isGuest: true,
    effectivePrefs: null,
    cartDishes: [dish({ name: "Cheese Bowl", allergens: ["Dairy"] })],
    allergenAck: undefined,
  });
  assert.equal(d.required, true);
  assert.deepEqual(d.allergens, ["Dairy"]);
  assert.deepEqual(d.dishes, ["Cheese Bowl"]);
});

test("assessAllergenAck: guest acknowledges → not required", () => {
  const d = assessAllergenAck({
    isGuest: true,
    effectivePrefs: null,
    cartDishes: [dish({ allergens: ["Dairy"] })],
    allergenAck: true,
  });
  assert.equal(d.required, false);
});

test("assessAllergenAck: guest who declared an allergen is informed → not required", () => {
  const d = assessAllergenAck({
    isGuest: true,
    effectivePrefs: normalizeGuestPrefs({ allergens: ["gluten"] }),
    cartDishes: [dish({ allergens: ["Dairy"] })],
  });
  assert.equal(d.required, false);
});

test("assessAllergenAck: authenticated user is never force-acked", () => {
  const d = assessAllergenAck({
    isGuest: false,
    effectivePrefs: null,
    cartDishes: [dish({ allergens: ["Dairy"] })],
  });
  assert.equal(d.required, false);
});

test("assessAllergenAck: guest, clean cart (no allergens/contra) → not required", () => {
  const d = assessAllergenAck({
    isGuest: true,
    effectivePrefs: null,
    cartDishes: [dish({ allergens: [], contraindications: [] })],
  });
  assert.equal(d.required, false);
});

test("assessAllergenAck: contraindication-only dish still forces ack", () => {
  const d = assessAllergenAck({
    isGuest: true,
    effectivePrefs: null,
    cartDishes: [dish({ name: "Charcoal Smoothie", allergens: [], contraindications: ["medication_interaction"] })],
  });
  assert.equal(d.required, true);
  assert.deepEqual(d.dishes, ["Charcoal Smoothie"]);
});

test("assessAllergenAck: guest who declared a medical condition is informed → not required", () => {
  const d = assessAllergenAck({
    isGuest: true,
    effectivePrefs: normalizeGuestPrefs({ medicalConditions: ["diabetes"] }),
    cartDishes: [dish({ allergens: ["Dairy"] })],
  });
  assert.equal(d.required, false);
});
