/**
 * TNM-MENU-01 M-5 §3.4 / §4.2 — the render guard that keeps fabricated
 * numbers and placeholder copy off the menu. Pure; no DOM, no network.
 * Run: node --test --import tsx ./lib/dishTrust.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  hasStubContent,
  hasStubIngredients,
  hasStubMacros,
  macroTrust,
  type DishTrustInput,
} from "./dishTrust";

const REAL_MACROS = { calories: 520, protein: 32, carbs: 40, fat: 18 };
/** The exact placeholder bucket observed on 16 live production rows. */
const STUB_MACROS = { calories: 460, protein: 18, carbs: 45, fat: 14 };

test("stub ingredient list is the WHOLE list, not a substring match", () => {
  assert.equal(hasStubIngredients({ ingredients: ["fresh ingredients"] }), true);
  assert.equal(hasStubIngredients({ ingredients: ["Fresh Ingredients"] }), true, "case-insensitive");
  assert.equal(hasStubIngredients({ ingredients: ["  fresh ingredients  "] }), true, "trimmed");
  // A real recipe that merely mentions the phrase is NOT a stub.
  assert.equal(
    hasStubIngredients({ ingredients: ["Paneer – 120 g", "fresh ingredients"] }),
    false,
    "two entries is a real list, even if one echoes the phrase",
  );
  assert.equal(hasStubIngredients({ ingredients: [] }), false);
  assert.equal(hasStubIngredients({}), false);
});

test("stub macros match only on all four macronutrients together", () => {
  assert.equal(hasStubMacros({ macros: STUB_MACROS }), true);
  // Any single field differing means it is a real (if coincidental) value.
  assert.equal(hasStubMacros({ macros: { ...STUB_MACROS, protein: 19 } }), false);
  assert.equal(hasStubMacros({ macros: { ...STUB_MACROS, calories: 461 } }), false);
  assert.equal(hasStubMacros({ macros: REAL_MACROS }), false);
  assert.equal(hasStubMacros({}), false);
});

test("macroTrust: curated values are verified", () => {
  assert.equal(macroTrust({ macros: REAL_MACROS }), "verified");
});

test("macroTrust: calculator-derived values are estimated, not hidden", () => {
  assert.equal(macroTrust({ macros: REAL_MACROS, macrosEstimated: true }), "estimated");
});

test("macroTrust: the placeholder bucket is unverified even without a flag", () => {
  // This is the F8 case: 16 live rows carry these numbers and are NOT
  // flagged provisional, so the flag alone would let them render as fact.
  assert.equal(macroTrust({ macros: STUB_MACROS }), "unverified");
  assert.equal(macroTrust({ macros: STUB_MACROS, macrosEstimated: true }), "unverified");
});

test("macroTrust: an explicit provisional flag wins over everything", () => {
  assert.equal(
    macroTrust({ macros: REAL_MACROS, macrosEstimated: true, macrosProvisional: true }),
    "unverified",
  );
});

test("macroTrust: absent or zeroed macros are unverified, never 'verified'", () => {
  assert.equal(macroTrust({}), "unverified");
  assert.equal(macroTrust({ macros: null }), "unverified");
  assert.equal(macroTrust({ macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } }), "unverified");
});

test("hasStubContent is the union of both signals", () => {
  // Production shape: 18 ingredient-stubbed, 16 macro-stubbed, 13 overlap.
  const ingOnly: DishTrustInput = { ingredients: ["fresh ingredients"], macros: REAL_MACROS };
  const macOnly: DishTrustInput = { ingredients: ["Paneer – 120 g"], macros: STUB_MACROS };
  const both: DishTrustInput = { ingredients: ["fresh ingredients"], macros: STUB_MACROS };
  const clean: DishTrustInput = { ingredients: ["Paneer – 120 g"], macros: REAL_MACROS };

  assert.equal(hasStubContent(ingOnly), true);
  assert.equal(hasStubContent(macOnly), true);
  assert.equal(hasStubContent(both), true);
  assert.equal(hasStubContent(clean), false);
});

test("a real dish is never mistaken for a stub", () => {
  const real: DishTrustInput = {
    ingredients: ["Grilled chicken – 120 g", "Brown rice – 150 g", "Broccoli – 70 g"],
    macros: REAL_MACROS,
    macrosEstimated: false,
  };
  assert.equal(hasStubContent(real), false);
  assert.equal(macroTrust(real), "verified");
});
