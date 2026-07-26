import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDishValue, sortDishesByValue } from "./dealSort";
import type { DishData } from "@workspace/menu-catalog";

const dishA: DishData = {
  id: 1,
  name: "High Protein Salad",
  slug: "hp-salad",
  price: 30000,
  macros: { protein: 30, fiber: 12, calories: 400, carbs: 10, fat: 5 },
  kitchen: "continental",
  diet: [],
  allergens: [],
  ingredients: ["greens", "chicken"],
  description: "",
  image: "",
} as any;

const dishB: DishData = {
  id: 2,
  name: "Economy Bowl",
  slug: "eco-bowl",
  price: 20000,
  macros: { protein: 28, fiber: 6, calories: 500, carbs: 30, fat: 12 },
  kitchen: "indian",
  diet: [],
  allergens: [],
  ingredients: ["rice", "dal"],
  description: "",
  image: "",
} as any;

test("evaluateDishValue calculates correct protein per rupee efficiency", () => {
  const scoreA = evaluateDishValue(dishA, "protein_per_rupee");
  assert.equal(scoreA.score, 10);
  assert.equal(scoreA.valueLabel, "10.0g Protein per ₹100");
});

test("sortDishesByValue orders by protein density correctly", () => {
  const sorted = sortDishesByValue([dishA, dishB], "protein_per_rupee");
  assert.equal(sorted[0]!.dish.slug, "eco-bowl"); // 14g vs 10g per ₹100
  assert.equal(sorted[1]!.dish.slug, "hp-salad");
});

test("sortDishesByValue orders by fiber density correctly", () => {
  const sorted = sortDishesByValue([dishA, dishB], "fiber_per_rupee");
  assert.equal(sorted[0]!.dish.slug, "hp-salad"); // 4g vs 3g per ₹100
});
