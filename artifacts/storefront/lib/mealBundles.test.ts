import { test } from "node:test";
import assert from "node:assert/strict";
import { DISHES, isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { buildBundle, buildBundles, BUNDLE_SPECS } from "./mealBundles";

// isAlaCarteEnabled keys off a fixed hero-slug set, so fixtures must reuse REAL
// hero slugs — a synthetic slug silently drops out of every bundle.
const HEROES = DISHES.filter((d) => isAlaCarteEnabled(d));

/** The nth à-la-carte hero, with non-slug fields overridden for the case at hand. */
function hero(index: number, overrides: Partial<Omit<DishData, "slug">> = {}): DishData {
  const base = HEROES[index];
  assert.ok(base, `catalog needs at least ${index + 1} à-la-carte heroes`);
  return { ...base, ...overrides } as DishData;
}

function withMacros(dish: DishData, macros: Partial<DishData["macros"]>): DishData {
  return { ...dish, macros: { ...dish.macros, ...macros } };
}

const spec = BUNDLE_SPECS[0]!;

test("the catalog has enough à-la-carte heroes to fixture against", () => {
  assert.ok(HEROES.length >= 3, `expected 3+ heroes, found ${HEROES.length}`);
});

test("a bundle's total is the sum of its constituents' catalog prices", () => {
  const dishes = [hero(0, { price: 30000 }), hero(1, { price: 40000 })];
  const bundle = buildBundle({ ...spec, mealCount: 2 }, dishes);
  assert.equal(bundle.dishes.length, 2);
  assert.equal(bundle.totalPaise, 70000);
});

test("an empty catalog yields a zero total and an incomplete bundle", () => {
  // Fail-safe: never invent an amount when there is nothing to price.
  const bundle = buildBundle(spec, []);
  assert.equal(bundle.totalPaise, 0);
  assert.equal(bundle.complete, false);
  assert.deepEqual(bundle.dishes, []);
});

test("an under-filled bundle is marked incomplete and dropped from the list", () => {
  const dishes = [hero(0, { price: 30000 })];
  assert.equal(buildBundle({ ...spec, mealCount: 5 }, dishes).complete, false);
  assert.deepEqual(buildBundles(dishes), []);
});

test("bundles only ever contain à-la-carte heroes, so Add Combo can work", () => {
  const bundles = buildBundles(DISHES);
  assert.ok(bundles.length > 0, "the real catalog should fill at least one bundle");
  for (const b of bundles) {
    for (const d of b.dishes) {
      assert.equal(isAlaCarteEnabled(d), true, `${d.slug} is not à-la-carte orderable`);
    }
  }
});

test("a non-hero dish never enters a bundle even if it scores best", () => {
  const nonHero = DISHES.find((d) => !isAlaCarteEnabled(d));
  assert.ok(nonHero, "catalog must contain a non-hero dish");
  const stacked = withMacros({ ...nonHero, price: 100 }, { protein: 999 });
  const bundle = buildBundle({ ...spec, rule: "high_protein", mealCount: 1 }, [stacked, hero(0)]);
  assert.notEqual(bundle.dishes[0]?.slug, nonHero.slug);
});

test("unavailable dishes are excluded even when they are heroes", () => {
  const dishes = [hero(0, { price: 30000, isAvailable: false }), hero(1, { price: 40000 })];
  const bundle = buildBundle({ ...spec, mealCount: 2 }, dishes);
  assert.equal(bundle.complete, false);
  assert.equal(bundle.dishes.length, 1);
  assert.equal(bundle.dishes[0]?.slug, HEROES[1]?.slug);
});

test("the low-GI rule never admits a high-GI dish", () => {
  const dishes = [
    hero(0, { price: 10000, glycaemicIndex: "high" }),
    hero(1, { price: 20000, glycaemicIndex: "low" }),
  ];
  const bundle = buildBundle({ ...spec, rule: "low_gi", mealCount: 1 }, dishes);
  assert.equal(bundle.dishes[0]?.slug, HEROES[1]?.slug);
});

test("the low-GI/high-fibre rule excludes high-GI and prefers more fibre", () => {
  const dishes = [
    hero(0, { price: 10000, glycaemicIndex: "high" }),
    withMacros(hero(1, { price: 10000, glycaemicIndex: "medium" }), { fiber: 2 }),
    withMacros(hero(2, { price: 10000, glycaemicIndex: "low" }), { fiber: 12 }),
  ];
  const bundle = buildBundle({ ...spec, rule: "low_gi_high_fibre", mealCount: 3 }, dishes);
  assert.deepEqual(
    bundle.dishes.map((d) => d.slug),
    [HEROES[2]?.slug, HEROES[1]?.slug],
  );
});

test("the high-protein rule orders by protein, descending", () => {
  const dishes = [
    withMacros(hero(0, { price: 10000 }), { protein: 12 }),
    withMacros(hero(1, { price: 10000 }), { protein: 44 }),
  ];
  const bundle = buildBundle({ ...spec, rule: "high_protein", mealCount: 2 }, dishes);
  assert.deepEqual(
    bundle.dishes.map((d) => d.slug),
    [HEROES[1]?.slug, HEROES[0]?.slug],
  );
});

test("selection is deterministic regardless of input order", () => {
  const dishes = [
    withMacros(hero(0, { price: 10000 }), { protein: 20 }),
    withMacros(hero(1, { price: 10000 }), { protein: 20 }),
  ];
  const first = buildBundle({ ...spec, rule: "high_protein", mealCount: 1 }, dishes);
  const second = buildBundle({ ...spec, rule: "high_protein", mealCount: 1 }, [...dishes].reverse());
  assert.equal(first.dishes[0]?.slug, second.dishes[0]?.slug);
});

test("buildBundles does not mutate the catalog it is given", () => {
  const dishes = [hero(0), hero(1)];
  const before = dishes.map((d) => d.slug);
  buildBundles(dishes);
  assert.deepEqual(dishes.map((d) => d.slug), before);
});

test("every real-catalog bundle prices above zero", () => {
  for (const b of buildBundles(DISHES)) {
    assert.ok(b.totalPaise > 0, `${b.id} priced at ${b.totalPaise}`);
  }
});
