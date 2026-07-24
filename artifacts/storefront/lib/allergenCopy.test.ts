/**
 * Allergen disclosure → PDP copy. This is the safety-critical mapping, so every
 * state is pinned. The load-bearing lock: only reviewed-and-empty may claim
 * "no declared allergens" (affirmativeNone). Derived-empty and unchecked must
 * NEVER assert absence — an empty list there means "unknown", not "none".
 * Run: node --test --import tsx ./lib/allergenCopy.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { allergenView } from "./allergenCopy";

test("reviewed + items → Contains, not affirmative", () => {
  const v = allergenView({ allergens: ["Peanuts", "Milk"], allergensReviewed: true });
  assert.equal(v.heading, "Contains");
  assert.deepEqual(v.items, ["Peanuts", "Milk"]);
  assert.equal(v.affirmativeNone, false);
  assert.equal(v.tone, "neutral");
});

test("reviewed + empty → the ONLY affirmative 'no declared allergens'", () => {
  const v = allergenView({ allergens: [], allergensReviewed: true });
  assert.equal(v.heading, "No declared allergens");
  assert.equal(v.affirmativeNone, true);
});

test("absent allergensReviewed defaults to reviewed (legacy curated catalog)", () => {
  const v = allergenView({ allergens: [] });
  assert.equal(v.affirmativeNone, true);
});

test("derived + items → auto-detected, never affirmative", () => {
  const v = allergenView({ allergens: ["Gluten"], allergensDerived: true });
  assert.equal(v.heading, "Auto-detected allergens");
  assert.deepEqual(v.items, ["Gluten"]);
  assert.equal(v.affirmativeNone, false);
});

test("derived + empty → NOT an affirmative 'none' (cannot certify absence)", () => {
  const v = allergenView({ allergens: [], allergensDerived: true });
  assert.equal(v.heading, "No allergens auto-detected");
  assert.equal(v.affirmativeNone, false);
});

test("unchecked → warn tone, never claims 'none'", () => {
  const v = allergenView({ allergens: [], allergensReviewed: false });
  assert.equal(v.tone, "warn");
  assert.equal(v.affirmativeNone, false);
  assert.match(v.heading, /under review/i);
  assert.deepEqual(v.items, []);
});

test("unchecked wins even if a stale allergens array is present", () => {
  const v = allergenView({ allergens: ["Soy"], allergensReviewed: false });
  assert.equal(v.tone, "warn");
  assert.equal(v.affirmativeNone, false);
  assert.deepEqual(v.items, []); // unchecked never surfaces a list
});
