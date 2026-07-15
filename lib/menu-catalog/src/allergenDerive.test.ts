import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveAllergensFromIngredients } from "./allergenDerive";

// ── detection: allergens PRESENT ─────────────────────────────────────────────
test("battered/fried items derive Gluten (the old []-mislabel case)", () => {
  const r = deriveAllergensFromIngredients([
    "Brown rice – 150 g (cooked)",
    "Mushrooms – 120 g (battered & fried)",
    "Bell peppers & onion – 50 g",
    "Lettuce – 20 g",
  ]);
  assert.ok(r.detected.includes("Gluten"));
});

test("hummus derives Sesame (tahini)", () => {
  const r = deriveAllergensFromIngredients([
    "Hummus – 3 tbsp",
    "Chickpeas – 50 g (boiled)",
    "Tomato – 40 g",
    "Cucumber – 40 g",
    "Olive oil – 1 tbsp",
    "Lemon juice – ½ tbsp",
  ]);
  assert.ok(r.detected.includes("Sesame"));
  assert.deepEqual(r.ambiguous, []);
});

test("paneer/cheese derive Dairy; egg derives Eggs", () => {
  const r = deriveAllergensFromIngredients(["Paneer – 60 g", "Egg – 2", "Cheese – 20 g"]);
  assert.ok(r.detected.includes("Dairy"));
  assert.ok(r.detected.includes("Eggs"));
});

test("soy sauce derives BOTH Soy and Gluten", () => {
  const r = deriveAllergensFromIngredients(["Soy sauce – 1 tbsp", "Rice – 150 g"]);
  assert.ok(r.detected.includes("Soy"));
  assert.ok(r.detected.includes("Gluten"));
});

test("almond milk is a Tree Nut, NOT Dairy", () => {
  const r = deriveAllergensFromIngredients(["Almond milk – 200 ml", "Banana – 1"]);
  assert.ok(r.detected.includes("Tree Nuts"));
  assert.ok(!r.detected.includes("Dairy"));
  assert.deepEqual(r.ambiguous, []);
});

test("prawns derive Shellfish; wheat tortilla derives Gluten", () => {
  const r = deriveAllergensFromIngredients(["Prawns – 80 g", "Whole wheat tortilla – 1"]);
  assert.ok(r.detected.includes("Shellfish"));
  assert.ok(r.detected.includes("Gluten"));
});

// ── absence: derivation NEVER certifies allergen-free ────────────────────────
test("a vague 'sauce of choice' is ambiguous → dish must fail closed", () => {
  const r = deriveAllergensFromIngredients([
    "Brown rice – 150 g",
    "Grilled chicken – 100 g",
    "Sauce/dip of choice – 2 tbsp",
  ]);
  assert.ok(r.ambiguous.length > 0);
  assert.ok(r.ambiguous.some((s) => /sauce\/dip of choice/i.test(s)));
});

test("an all-recognized safe dish has no ambiguity and no allergens", () => {
  const r = deriveAllergensFromIngredients([
    "Watermelon cubes – 200 g",
    "Lemon juice – ½ tbsp",
    "Mint leaves – 4–5",
    "Ice cubes – 3–4",
  ]);
  assert.deepEqual(r.detected, []);
  assert.deepEqual(r.ambiguous, []);
});

test("an unrecognized novel ingredient fails closed (reported ambiguous)", () => {
  const r = deriveAllergensFromIngredients(["Mystery house blend – 2 tbsp"]);
  assert.deepEqual(r.ambiguous, ["Mystery house blend – 2 tbsp"]);
});

test("detected list is de-duplicated", () => {
  const r = deriveAllergensFromIngredients(["Cheese – 10 g", "Paneer – 20 g", "Butter – 5 g"]);
  assert.deepEqual(r.detected, ["Dairy"]);
});
