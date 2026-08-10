/**
 * Pure tests for the pre-submit allergen-flagging predicate (A2). DB-free,
 * DOM-free. Run: node --test --import tsx ./lib/allergenAck.test.ts (from
 * artifacts/api-server for the tsx loader, per the storefront lib convention).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { flagCartAllergens } from "./allergenAck";

const NUTS = { id: 1, name: "Peanut Satay Bowl", allergens: ["peanuts", "soy"] };
const CLEAN = { id: 2, name: "Steamed Rice Bowl", allergens: [] };
const CONTRA_ONLY = { id: 3, name: "High-Sodium Broth", allergens: [], contraindications: ["hypertension"] };
const MENU = [NUTS, CLEAN, CONTRA_ONLY];

test("flags a cart dish with a declared allergen, names the dish and the allergens", () => {
  const result = flagCartAllergens([NUTS.id], MENU);
  assert.equal(result.dishes.length, 1);
  assert.equal(result.dishes[0]?.name, "Peanut Satay Bowl");
  assert.deepEqual(result.allergens, ["peanuts", "soy"]);
});

test("flags a contraindication-only dish too — the server's OR, not just allergens", () => {
  const result = flagCartAllergens([CONTRA_ONLY.id], MENU);
  assert.equal(result.dishes.length, 1);
  assert.equal(result.dishes[0]?.name, "High-Sodium Broth");
  // Contraindications aren't allergens — the union stays empty even though
  // the dish is flagged, matching assessAllergenAck's `allergens` field
  // (built only from `d.allergens`, never contraindications).
  assert.deepEqual(result.allergens, []);
});

test("a cart of only clean dishes flags nothing", () => {
  const result = flagCartAllergens([CLEAN.id], MENU);
  assert.deepEqual(result.dishes, []);
  assert.deepEqual(result.allergens, []);
});

test("de-dupes allergens across multiple flagged dishes", () => {
  const alsoNuts = { id: 4, name: "Cashew Curry", allergens: ["peanuts", "tree nuts"] };
  const result = flagCartAllergens([NUTS.id, alsoNuts.id], [...MENU, alsoNuts]);
  assert.equal(result.dishes.length, 2);
  assert.deepEqual([...result.allergens].sort(), ["peanuts", "soy", "tree nuts"].sort());
});

test("a cart dish id absent from the menu snapshot is silently not flagged", () => {
  // Stale cache / a dish that left the menu — the server can't flag what it
  // can't resolve either, so this must not throw or fabricate a flag.
  const result = flagCartAllergens([9999], MENU);
  assert.deepEqual(result.dishes, []);
});

test("empty cart flags nothing", () => {
  const result = flagCartAllergens([], MENU);
  assert.deepEqual(result.dishes, []);
  assert.deepEqual(result.allergens, []);
});
