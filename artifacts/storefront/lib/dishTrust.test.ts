/**
 * TNM-MENU-01 M-5 §3.4 / §4.2 — the render guard that keeps fabricated
 * numbers and placeholder copy off the menu. Pure; no DOM, no network.
 * Run: node --test --import tsx ./lib/dishTrust.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSharedMacroKeys,
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

// ── F-1: shared macro tuples ────────────────────────────────────────────────
//
// The stub check above matches ONE hard-coded bucket found by hand. The
// flipbook review showed that was the visible corner: 93 live dishes share
// macros drawn from 32 distinct tuples, and the stub bucket is only one of
// them. These pin the generalisation.

test("buildSharedMacroKeys: only tuples used by MORE than one dish", () => {
  const shared = buildSharedMacroKeys([
    { macros: REAL_MACROS },
    { macros: REAL_MACROS },
    { macros: { calories: 100, protein: 1, carbs: 2, fat: 3 } },
  ]);
  assert.equal(shared.size, 1, "the unique tuple must not be flagged");
  assert.equal(shared.has("520|32|40|18"), true);
  assert.equal(shared.has("100|1|2|3"), false);
});

test("buildSharedMacroKeys: dishes without macros are skipped, not grouped", () => {
  // Three dishes with no macros must NOT collapse into one 'shared' bucket —
  // absent is not a value, and treating it as one would flag every dish in a
  // macro-less catalog.
  const shared = buildSharedMacroKeys([{}, { macros: null }, {}]);
  assert.equal(shared.size, 0);
});

test("buildSharedMacroKeys: a clean catalog yields an empty set", () => {
  // The static fallback catalog is exactly this shape — 116 dishes, 116
  // distinct tuples — which is why the set must be built from the payload
  // being rendered rather than from the bundled catalog.
  const shared = buildSharedMacroKeys([
    { macros: { calories: 1, protein: 1, carbs: 1, fat: 1 } },
    { macros: { calories: 2, protein: 1, carbs: 1, fat: 1 } },
  ]);
  assert.equal(shared.size, 0);
});

test("macroTrust: a shared tuple is unverified even when otherwise curated", () => {
  const shared = buildSharedMacroKeys([{ macros: REAL_MACROS }, { macros: REAL_MACROS }]);
  // Without catalog context this reads as a real curated value...
  assert.equal(macroTrust({ macros: REAL_MACROS }), "verified");
  // ...with it, the number cannot be claimed at all.
  assert.equal(macroTrust({ macros: REAL_MACROS }, shared), "unverified");
});

test("macroTrust: a shared tuple is unverified even when flagged estimated", () => {
  // The ≈ marker still asserts "we computed this for THIS dish", which a
  // copied row cannot support. Demoting to 'estimated' would be a softer lie,
  // not a fix — this is the Diet Coke case (≈140 kcal · ≈3 g P, actually 0/0).
  const shared = buildSharedMacroKeys([{ macros: REAL_MACROS }, { macros: REAL_MACROS }]);
  assert.equal(
    macroTrust({ macros: REAL_MACROS, macrosEstimated: true }, shared),
    "unverified",
  );
});

test("macroTrust: a unique tuple is unaffected by the shared set", () => {
  const shared = buildSharedMacroKeys([{ macros: REAL_MACROS }, { macros: REAL_MACROS }]);
  const unique = { calories: 311, protein: 9, carbs: 7, fat: 5 };
  assert.equal(macroTrust({ macros: unique }, shared), "verified");
  assert.equal(macroTrust({ macros: unique, macrosEstimated: true }, shared), "estimated");
});

test("macroTrust: omitting the shared set keeps the pre-F-1 behaviour exactly", () => {
  // The optional parameter must not change any existing verdict — the render
  // layer requires it, but the pure function stays a one-dish predicate.
  const cases: DishTrustInput[] = [
    { macros: REAL_MACROS },
    { macros: REAL_MACROS, macrosEstimated: true },
    { macros: STUB_MACROS },
    { macros: REAL_MACROS, macrosProvisional: true },
    {},
  ];
  for (const c of cases) assert.equal(macroTrust(c), macroTrust(c, new Set()));
});

test("macroTrust: the F-1 case that motivated this — the 460/18/45/14 family", () => {
  // Two unrelated dishes carrying the placeholder bucket. Both gates fire;
  // the shared-tuple gate would have caught it even if the bucket's exact
  // values had never been hard-coded above.
  const aamPanna = { macros: STUB_MACROS };
  const garlicBread = { macros: STUB_MACROS };
  const shared = buildSharedMacroKeys([aamPanna, garlicBread]);
  assert.equal(shared.has("460|18|45|14"), true);
  assert.equal(macroTrust(aamPanna, shared), "unverified");
  assert.equal(macroTrust(garlicBread, shared), "unverified");
});
