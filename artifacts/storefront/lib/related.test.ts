/**
 * PDP cross-sell selectors (pairing + related). Locks: a pairing only resolves
 * to a real, available, non-self dish; related pulls same-category available
 * dishes, excludes self AND the pairing, and caps at the limit; catalog order
 * is preserved (no re-sort).
 * Run: node --test --import tsx ./lib/related.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import { resolvePairing, relatedDishes, dishCrossSell } from "./related";

const BASE = DISHES[0]!;
function dish(overrides: Partial<DishData>): DishData {
  return { ...BASE, ...overrides } as DishData;
}

const A = dish({ slug: "a", category: "bowls", isAvailable: true, pairingSlug: undefined });
const B = dish({ slug: "b", category: "bowls", isAvailable: true });
const C = dish({ slug: "c", category: "bowls", isAvailable: true });
const D = dish({ slug: "d", category: "salads", isAvailable: true });
const GONE = dish({ slug: "gone", category: "bowls", isAvailable: false });
const ALL = [A, B, C, D, GONE];

test("resolvePairing returns the named, available dish", () => {
  const withPair = dish({ slug: "a", pairingSlug: "b" });
  assert.equal(resolvePairing(withPair, ALL)?.slug, "b");
});

test("resolvePairing ignores a self-referential pairingSlug", () => {
  assert.equal(resolvePairing(dish({ slug: "a", pairingSlug: "a" }), ALL), undefined);
});

test("resolvePairing ignores an unknown or unavailable target", () => {
  assert.equal(resolvePairing(dish({ slug: "a", pairingSlug: "nope" }), ALL), undefined);
  assert.equal(resolvePairing(dish({ slug: "a", pairingSlug: "gone" }), ALL), undefined);
});

test("resolvePairing returns undefined when pairingSlug is unset", () => {
  assert.equal(resolvePairing(A, ALL), undefined);
});

test("relatedDishes returns same-category, available dishes excluding self", () => {
  const out = relatedDishes(A, ALL).map((d) => d.slug);
  assert.deepEqual(out, ["b", "c"]); // d is a salad, gone is unavailable, a is self
});

test("relatedDishes excludes the pairing and honours the limit", () => {
  const out = relatedDishes(A, ALL, 1, "b").map((d) => d.slug);
  assert.deepEqual(out, ["c"]);
});

test("dishCrossSell keeps the pairing out of the related rail", () => {
  const withPair = dish({ slug: "a", category: "bowls", pairingSlug: "b" });
  const { pairing, related } = dishCrossSell(withPair, ALL);
  assert.equal(pairing?.slug, "b");
  assert.deepEqual(related.map((d) => d.slug), ["c"]);
});
