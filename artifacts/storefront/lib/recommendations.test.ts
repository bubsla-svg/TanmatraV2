import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSmartRecommendation, recommendMenu } from "./recommendations";
import type { DishData } from "@workspace/menu-catalog";

const testDish: DishData = {
  id: 1,
  name: "High Protein Paneer Bowl",
  slug: "hp-paneer-bowl",
  price: 35000,
  macros: { protein: 32, carbs: 20, fat: 15, fiber: 11, calories: 450 },
  kitchen: "indian",
  diet: ["vegetarian"],
  allergens: ["dairy"],
  ingredients: ["paneer", "greens"],
  description: "Macro calibrated paneer protein bowl.",
  image: "/images/paneer.jpg",
  tags: [],
} as any;

test("generateSmartRecommendation identifies glycemic control for PCOS profiles", () => {
  const rec = generateSmartRecommendation(testDish, {
    dietaryStyle: "omnivore",
    medicalConditions: ["pcos"],
  });
  assert.equal(rec.badge, "Glycemic Control Select");
  assert.match(rec.rationale, /blood sugar stabilization/i);
});

test("generateSmartRecommendation flags high protein protocols", () => {
  const rec = generateSmartRecommendation(testDish, {
    dietaryStyle: "omnivore",
    goal: "gain_muscle",
  });
  assert.equal(rec.badge, "High Protein Protocol");
});

test("generateSmartRecommendation returns conflict for allergen match", () => {
  const rec = generateSmartRecommendation(testDish, {
    dietaryStyle: "omnivore",
    allergens: ["dairy"],
  });
  assert.equal(rec.fit.band, "conflict");
  assert.match(rec.rationale, /contains dairy/i);
});

test("recommendMenu filters out conflicting items when excludeConflicts is true", () => {
  const recs = recommendMenu([testDish], { dietaryStyle: "omnivore", allergens: ["dairy"] }, true);
  assert.equal(recs.length, 0);
});
