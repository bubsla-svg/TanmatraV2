/**
 * The trial trio resolver — shared by /trial and the QR landing, which is
 * exactly why it is worth locking. Two surfaces selling one offer must not be
 * able to disagree about what is in the box.
 * Run: node --test --import tsx ./lib/trialTrio.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import { buildSharedMacroKeys } from "./dishTrust";
import { TRIAL_TRIO } from "./trial";
import { resolveTrio } from "./trialTrio";

const BASE = DISHES[0]!;
function dish(overrides: Partial<DishData>): DishData {
  return {
    ...BASE,
    macrosProvisional: false,
    macrosEstimated: false,
    ...overrides,
  } as DishData;
}

const VEG_SLUGS = TRIAL_TRIO.veg;

function trioDishes(): DishData[] {
  return VEG_SLUGS.map((slug, i) =>
    dish({
      id: 900 + i,
      slug,
      name: `Trio ${i}`,
      image: `/images/dishes/${slug}.jpg`,
      // Distinct macros so no pair looks like a copied tuple.
      macros: { ...BASE.macros, calories: 500 + i, protein: 30 + i },
    }),
  );
}

test("resolveTrio returns the track's fixed slugs, in the spine's order", () => {
  const dishes = trioDishes();
  const trio = resolveTrio("veg", dishes, buildSharedMacroKeys(dishes));
  assert.deepEqual(trio.map((d) => d.slug), VEG_SLUGS);
  assert.deepEqual(trio.map((d) => d.name), ["Trio 0", "Trio 1", "Trio 2"]);
});

test("resolveTrio carries macros through when the catalog can back them", () => {
  const dishes = trioDishes();
  const trio = resolveTrio("veg", dishes, buildSharedMacroKeys(dishes));
  assert.deepEqual(trio[0]?.macros, { calories: 500, protein: 30 });
  assert.equal(trio[0]?.macrosEstimated, false);
});

test("resolveTrio omits macros it cannot vouch for rather than filling them in", () => {
  // Law 8 on the highest-intent dish moment in the funnel: a provisional tuple
  // is shown as no number at all, never as a number without its caveat.
  const dishes = trioDishes().map((d, i) => (i === 0 ? { ...d, macrosProvisional: true } : d));
  const trio = resolveTrio("veg", dishes, buildSharedMacroKeys(dishes));
  assert.equal(trio[0]?.macros, undefined);
  assert.equal(trio[0]?.macrosEstimated, undefined);
  assert.notEqual(trio[1]?.macros, undefined, "only the untrustworthy dish loses its numbers");
});

test("resolveTrio treats a macro tuple duplicated across dishes as untrustworthy", () => {
  // F-1: the duplication arrives in the DB payload, where a copied tuple may
  // carry no provisional flag at all — the shared-key check is what catches it.
  const dishes = trioDishes();
  const copied = dishes.map((d) => ({ ...d, macros: { ...BASE.macros, calories: 500, protein: 30 } }));
  const trio = resolveTrio("veg", copied, buildSharedMacroKeys(copied));
  assert.equal(trio.length, 3);
  assert.deepEqual(trio.map((d) => d.macros), [undefined, undefined, undefined]);
});

test("resolveTrio drops a slug the catalog does not have, and never fakes one", () => {
  // A catalogue gap costs a thumbnail. The price is the spine's regardless, so
  // inventing a dish here would misstate what actually arrives.
  const dishes = trioDishes().slice(1);
  const trio = resolveTrio("veg", dishes, buildSharedMacroKeys(dishes));
  assert.equal(trio.length, 2);
  assert.deepEqual(trio.map((d) => d.slug), VEG_SLUGS.slice(1));
});

test("resolveTrio returns nothing when the catalog holds none of the trio", () => {
  const trio = resolveTrio("veg", [dish({ id: 1, slug: "unrelated" })], new Set());
  assert.deepEqual(trio, []);
});

test("resolveTrio keeps the two tracks distinct", () => {
  assert.notDeepEqual(TRIAL_TRIO.veg, TRIAL_TRIO.nonveg);
  const dishes = trioDishes();
  assert.deepEqual(resolveTrio("nonveg", dishes, buildSharedMacroKeys(dishes)), []);
});
