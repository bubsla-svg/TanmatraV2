import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_FILTERS,
  activeFilterLabels,
  countActiveFilters,
  filterDishes,
  normaliseBound,
  setBound,
  type DishForFilter,
} from "./menuFilters";

const dish = (id: number, protein: number, calories: number): DishForFilter => ({
  id,
  isVeg: true,
  allergens: [],
  ingredients: [],
  glycaemicIndex: "low",
  macros: { protein, carbs: 40, fiber: 5, calories },
});

const all = [dish(1, 12, 320), dish(2, 31, 480), dish(3, 45, 640)];

test("numeric bounds narrow the list and AND with each other", () => {
  assert.deepEqual(filterDishes(all, { ...EMPTY_FILTERS, proteinMin: 30 }).map((d) => d.id), [2, 3]);
  assert.deepEqual(filterDishes(all, { ...EMPTY_FILTERS, kcalMax: 500 }).map((d) => d.id), [1, 2]);
  assert.deepEqual(
    filterDishes(all, { ...EMPTY_FILTERS, proteinMin: 30, kcalMax: 500 }).map((d) => d.id),
    [2],
  );
});

test("a bound counts as one active filter and explains itself", () => {
  const f = setBound(setBound(EMPTY_FILTERS, "proteinMin", 30), "kcalMax", 500);
  assert.equal(countActiveFilters(f), 2);
  assert.deepEqual(activeFilterLabels(f), ["30g+ protein", "Under 500 kcal"]);
  assert.equal(countActiveFilters(EMPTY_FILTERS), 0, "the input state must not be mutated");
});

test("bounds snap to the slider grid and a rest position means no bound", () => {
  assert.equal(normaliseBound("proteinMin", "32"), 30);
  assert.equal(normaliseBound("kcalMax", 512), 500);
  assert.equal(normaliseBound("proteinMin", 0), null, "0 g is the slider's rest, not a filter");
  assert.equal(normaliseBound("kcalMax", 900), null, "the ceiling is the rest, not a filter");
  assert.equal(normaliseBound("proteinMin", "abc"), null);
  assert.equal(normaliseBound("kcalMax", -5), null);
  assert.equal(normaliseBound("proteinMin", 999), null, "off the grid is dropped, not clamped in");
});
