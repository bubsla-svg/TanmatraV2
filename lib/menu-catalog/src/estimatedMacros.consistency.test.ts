import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISHES,
  ESTIMATED_MACROS,
  computeCatalogMacrosFromIngredients,
} from "./index";

// The checked-in ESTIMATED_MACROS is a build artifact of the calculator run over
// each dish's RD-verified `ingredients` list. These tests keep the file honest:
// it must never drift from what the engine produces, and it must never ship a
// number the engine can't stand behind (low coverage or Atwater-incoherent).
// Regenerate with:
//   pnpm --filter @workspace/scripts exec tsx ./src/backfill-macros.ts \
//     --emit-estimated ../../lib/menu-catalog/src/estimatedMacros.ts

test("every estimated dish recomputes to its stored value", () => {
  for (const [slug, stored] of Object.entries(ESTIMATED_MACROS)) {
    const dish = DISHES.find((d) => d.slug === slug);
    assert.ok(dish, `estimated slug ${slug} has no catalog dish`);
    const res = computeCatalogMacrosFromIngredients(dish!.ingredients ?? []);
    assert.deepEqual(
      {
        protein: res.macros.proteinG,
        carbs: res.macros.carbsG,
        fat: res.macros.fatG,
        fiber: res.macros.fiberG,
        calories: res.macros.kcal,
      },
      stored,
      `${slug}: stored macros are stale — re-run --emit-estimated`,
    );
  }
});

test("every estimated dish is HIGH confidence and Atwater-consistent", () => {
  for (const slug of Object.keys(ESTIMATED_MACROS)) {
    const dish = DISHES.find((d) => d.slug === slug)!;
    const res = computeCatalogMacrosFromIngredients(dish.ingredients ?? []);
    assert.equal(res.confidence, "high", `${slug} is not high confidence`);
    assert.equal(
      res.atwaterConsistent,
      true,
      `${slug} energy vs macros off by ${res.atwaterDeltaPct}`,
    );
  }
});

test("no estimated macro exceeds a 15% Atwater gap", () => {
  for (const [slug, m] of Object.entries(ESTIMATED_MACROS)) {
    const atwater = 4 * m.protein + 4 * m.carbs + 9 * m.fat;
    if (m.calories <= 0) continue;
    const delta = Math.abs(atwater - m.calories) / m.calories;
    assert.ok(delta <= 0.15, `${slug}: ${m.calories} kcal vs Atwater ${atwater}`);
  }
});

// Regression locks for the specific defects the kitchen sheet fixed: phantom
// garnish weights and protein-blind pasta variants.
test("previously-broken dishes now carry sane macros", () => {
  const by = (slug: string) => {
    const m = ESTIMATED_MACROS[slug];
    assert.ok(m, `${slug} lost its estimate`);
    return m!;
  };

  // Quinoa Upma was 368 kcal / 26 g protein / 27 g fiber from 350 g of phantom
  // curry leaves. A single-serve upma is a light breakfast.
  const upma = by("quinoa-upma");
  assert.ok(upma.calories < 260, `upma ${upma.calories} kcal too high`);
  assert.ok(upma.fiber < 10 && upma.protein < 12);

  // A "zero calorie" mojito must actually be near zero.
  assert.ok(by("zero-calorie-mint-mojito").calories < 20);

  // A watermelon juice is not a protein source.
  assert.ok(by("hydrating-watermelon-juice").protein <= 3);

  // The three Alfredo variants shared one identical (protein-blind) macro row.
  // They must now differ, and the chicken one must out-protein the veg one.
  const chicken = by("alfredo-pasta-chicken");
  const veg = by("alfredo-pasta-veg");
  const prawns = by("alfredo-pasta-prawns");
  assert.ok(
    chicken.protein > veg.protein && prawns.protein > veg.protein,
    "meat Alfredo variants should out-protein the veg one",
  );
  assert.notDeepEqual(chicken, veg);
  assert.notDeepEqual(chicken, prawns);
});
