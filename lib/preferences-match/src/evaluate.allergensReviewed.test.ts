import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDishForPreferences } from "./index";
import type { DishData } from "@workspace/menu-catalog";

function dish(partial: Partial<DishData>): DishData {
  return {
    id: 1,
    slug: "x",
    name: "X",
    description: "",
    longDescription: "",
    image: "",
    price: 0,
    kitchen: "continental",
    category: "mains",
    isVeg: true,
    rdVerified: true,
    prepTime: "",
    macros: { protein: 10, carbs: 10, fat: 5, fiber: 2, calories: 200 },
    ingredients: [],
    allergens: [],
    glycaemicIndex: "low",
    sugarPerServing: "",
    customizations: [],
    isAvailable: true,
    ...partial,
  } as DishData;
}

test("strict gate blocks a dish whose allergen data is unchecked", () => {
  const r = evaluateDishForPreferences(dish({ allergensReviewed: false }), null, {
    strict: true,
  });
  assert.equal(r.blocked, true);
  assert.ok(r.blockReasons.some((b) => b.code === "unchecked_allergens"));
});

test("the unchecked block fires even with no declared buyer preferences", () => {
  // The whole point: an empty allergens array must not read as "safe" for a
  // guest who declared nothing. prefs === null still refuses the dish.
  const r = evaluateDishForPreferences(dish({ allergensReviewed: false }), null, {
    strict: true,
  });
  assert.equal(r.blocked, true);
});

test("soft (browse) mode does not hard-block an unchecked dish", () => {
  const r = evaluateDishForPreferences(dish({ allergensReviewed: false }), null);
  assert.equal(r.blocked, false);
  assert.equal(
    r.blockReasons.some((b) => b.code === "unchecked_allergens"),
    false,
  );
});

test("a reviewed empty allergen list is NOT caught by the unchecked gate", () => {
  const r = evaluateDishForPreferences(
    dish({ allergens: [], allergensReviewed: true }),
    null,
    { strict: true },
  );
  assert.equal(r.blocked, false);
});

test("a legacy dish (flag absent) still ships under the strict gate", () => {
  const r = evaluateDishForPreferences(dish({}), null, { strict: true });
  assert.equal(r.blocked, false);
});
