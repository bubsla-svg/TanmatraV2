import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseQuantity,
  toGrams,
  parseIngredientLine,
  parseLongDescription,
  computeDishMacros,
  computeDishMacrosFromIngredients,
  type NutritionTable,
} from "./nutritionCalc";

test("parseQuantity handles numbers, fractions, ranges", () => {
  assert.equal(parseQuantity("120"), 120);
  assert.equal(parseQuantity("1.5"), 1.5);
  assert.equal(parseQuantity("½"), 0.5);
  assert.equal(parseQuantity("1 ½"), 1.5);
  assert.equal(parseQuantity("1/2"), 0.5);
  assert.equal(parseQuantity("6–8"), 7); // en-dash range averages
  assert.equal(parseQuantity("6-8"), 7);
  assert.equal(parseQuantity("to taste"), null);
});

test("toGrams converts units and piece counts", () => {
  assert.equal(toGrams(100, "g", "broccoli"), 100);
  assert.equal(toGrams(200, "ml", "milk"), 200);
  assert.equal(toGrams(2, "tbsp", "olive oil"), 30);
  assert.equal(toGrams(1, "tsp", "honey"), 5);
  assert.equal(toGrams(6, "cloves", "garlic"), 18);
  assert.equal(toGrams(1, "medium", "banana"), 118);
  assert.equal(toGrams(2, "slices", "bread slices"), 56);
  assert.ok(Math.abs(toGrams(1, "large", "banana") - 118 * 1.3) < 0.01); // ~153.4 (rounding happens later)
});

test("parseIngredientLine parses name + grams, notes stripped", () => {
  assert.deepEqual(parseIngredientLine("Olive oil – 2 tbsp"), {
    name: "olive oil",
    grams: 30,
    raw: "Olive oil – 2 tbsp",
  });
  assert.deepEqual(parseIngredientLine("Banana – 1 medium (ripe)"), {
    name: "banana",
    grams: 118,
    raw: "Banana – 1 medium (ripe)",
  });
  // "to taste" → zero-weight, still named
  const st = parseIngredientLine("Salt & pepper – to taste");
  assert.equal(st?.name, "salt & pepper");
  assert.equal(st?.grams, 0);
  // "almond milk / low-fat milk" → first alternative
  assert.equal(parseIngredientLine("Almond milk / low-fat milk – 200 ml")?.name, "almond milk");
});

test("parseLongDescription splits on the middot separator", () => {
  const parsed = parseLongDescription("Broccoli – 100 g · Olive oil – 1 tbsp · Salt & pepper – to taste");
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]!.name, "broccoli");
  assert.equal(parsed[0]!.grams, 100);
  assert.equal(parsed[1]!.grams, 15);
  assert.equal(parsed[2]!.grams, 0);
});

const STUB: NutritionTable = {
  broccoli: { kcal: 34, proteinG: 2.8, carbsG: 7, fatG: 0.4, fiberG: 2.6, sodiumMg: 33, sugarG: 1.7 },
  "olive oil": { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0, sodiumMg: 2, sugarG: 0 },
  banana: { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, fiberG: 2.6, sodiumMg: 1, sugarG: 12 },
};

test("computeDishMacros sums scaled per-100g values with full coverage", () => {
  const r = computeDishMacros("Broccoli – 100 g · Olive oil – 1 tbsp", STUB);
  // broccoli 100g (×1) + olive oil 15g (×0.15)
  assert.equal(r.macros.kcal, Math.round(34 + 884 * 0.15)); // 34 + 132.6 = 167
  assert.equal(r.macros.fatG, Math.round(0.4 + 100 * 0.15)); // 15.4 → 15
  assert.equal(r.macros.proteinG, 3); // 2.8 → 3
  assert.equal(r.coverage, 1);
  assert.equal(r.matchedCount, 2);
  assert.equal(r.confidence, "high");
  assert.deepEqual(r.unmatched, []);
});

test("computeDishMacros reports partial coverage + low confidence for unknown ingredients", () => {
  // banana known (118g), "mystery paste" unknown (50g weighed)
  const r = computeDishMacros("Banana – 1 medium · Mystery paste – 50 g", STUB);
  assert.ok(r.macros.kcal > 0); // banana contributes
  assert.deepEqual(r.unmatched, ["mystery paste"]);
  assert.equal(r.matchedCount, 1);
  assert.equal(r.totalCount, 2);
  // matched 118g of 168g weighed → ~0.7 coverage → med
  assert.ok(r.coverage > 0.6 && r.coverage < 0.85);
  assert.equal(r.confidence, "med");
});

test("computeDishMacros ignores zero-weight (to taste) ingredients in coverage", () => {
  const r = computeDishMacros("Broccoli – 100 g · Salt & pepper – to taste", STUB);
  assert.equal(r.macros.kcal, 34);
  assert.equal(r.totalCount, 1); // salt & pepper has 0 weight → not counted
  assert.equal(r.coverage, 1);
});

// ── Spoon/cup: dry vs liquid weights (from the kitchen MEASUREMENTS table) ────
test("dry spoons/cups weigh less than liquid ones", () => {
  // Dry solids: cup 120 g · tbsp 8 g · tsp 3 g
  assert.equal(toGrams(1, "cup", "whole wheat flour"), 120);
  assert.equal(toGrams(1, "tbsp", "cocoa powder"), 8);
  assert.equal(toGrams(1, "tsp", "cinnamon powder"), 3);
  // Liquids (name matches the liquid signal): cup 240 ml · tbsp 15 ml · tsp 5 ml
  assert.equal(toGrams(1, "cup", "milk"), 240);
  assert.equal(toGrams(2, "tbsp", "olive oil"), 30);
  assert.equal(toGrams(1, "tsp", "honey"), 5);
});

// ── Leaf herbs counted by the leaf must not balloon (the 350 g curry-leaf bug) ─
test("leaf herbs counted by the leaf weigh grams, not hundreds of grams", () => {
  // "Curry leaves – 6–8" → 7 leaves × 0.3 g ≈ 2 g (was 7 × 50 g = 350 g).
  assert.equal(parseIngredientLine("Curry leaves – 6–8")?.grams, 2);
  assert.equal(parseIngredientLine("Mint leaves – 4–5")?.grams, 1);
  assert.equal(parseIngredientLine("Basil – 4 leaves")?.grams, 2);
  // A dish is no longer dominated by a garnish: basil is a rounding error next
  // to the eggs, not the largest "ingredient".
  const tbl: NutritionTable = {
    ...STUB,
    egg: { kcal: 143, proteinG: 13, carbsG: 0.7, fatG: 9.5, fiberG: 0, sodiumMg: 142, sugarG: 0.4 },
    basil: { kcal: 23, proteinG: 3.2, carbsG: 2.6, fatG: 0.6, fiberG: 1.6, sodiumMg: 4, sugarG: 0.3 },
  };
  const r = computeDishMacros("Egg – 2 · Basil – 4 leaves", tbl);
  assert.ok(r.macros.kcal < 300, `expected a 2-egg dish under 300 kcal, got ${r.macros.kcal}`);
});

// ── Atwater self-consistency guard ───────────────────────────────────────────
test("computeDishMacros reports Atwater consistency and demotes incoherent rows", () => {
  const good = computeDishMacros("Broccoli – 100 g · Olive oil – 1 tbsp", STUB);
  assert.equal(good.atwaterConsistent, true);
  assert.ok(good.atwaterDeltaPct <= 0.15);

  // A table row whose kcal can't be reconciled with its macros (200 kcal stated,
  // but 4·5 + 4·5 + 9·30 = 310) makes any dish built from it inconsistent, and
  // its confidence is demoted below "high" even at full coverage.
  const badTable: NutritionTable = {
    "mystery fat": { kcal: 200, proteinG: 5, carbsG: 5, fatG: 30, fiberG: 0, sodiumMg: 0, sugarG: 0 },
  };
  const bad = computeDishMacros("Mystery fat – 100 g", badTable);
  assert.equal(bad.coverage, 1);
  assert.equal(bad.atwaterConsistent, false);
  assert.notEqual(bad.confidence, "high");
});

// ── ingredients[] entry point ────────────────────────────────────────────────
test("computeDishMacrosFromIngredients matches the middot-joined form", () => {
  const fromList = computeDishMacrosFromIngredients(
    ["Broccoli – 100 g", "Olive oil – 1 tbsp"],
    STUB,
  );
  const fromStr = computeDishMacros("Broccoli – 100 g · Olive oil – 1 tbsp", STUB);
  assert.deepEqual(fromList.macros, fromStr.macros);
  assert.equal(fromList.matchedCount, 2);
});
