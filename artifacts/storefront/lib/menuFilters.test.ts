import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FILTERS,
  activeFilterLabels,
  countActiveFilters,
  dishMatchesFilters,
  filterDishes,
  isFilterActive,
  toggleFilter,
  type DishForFilter,
  type MenuFilterState,
} from "./menuFilters";

function dish(over: Partial<DishForFilter> & { id: number }): DishForFilter {
  return {
    isVeg: true,
    allergens: [],
    ingredients: [],
    glycaemicIndex: "medium",
    macros: { protein: 20, carbs: 50, fiber: 3, calories: 500 },
    ...over,
  };
}

const filters = (over: Partial<MenuFilterState>): MenuFilterState => ({
  ...EMPTY_FILTERS,
  ...over,
});

test("no active filters returns the input untouched — same array identity", () => {
  const all = [dish({ id: 1 }), dish({ id: 2 })];
  assert.equal(filterDishes(all, EMPTY_FILTERS), all);
  assert.equal(isFilterActive(EMPTY_FILTERS), false);
  assert.equal(countActiveFilters(EMPTY_FILTERS), 0);
});

test("goal chips OR within the group — a dish matching either survives", () => {
  const lean = dish({ id: 1, macros: { protein: 10, carbs: 30, fiber: 2, calories: 300 } });
  const protein = dish({ id: 2, macros: { protein: 40, carbs: 30, fiber: 2, calories: 700 } });
  const neither = dish({ id: 3, macros: { protein: 10, carbs: 30, fiber: 2, calories: 700 } });

  const f = filters({ goal: ["fat_loss", "high_protein"] });
  assert.deepEqual(
    filterDishes([lean, protein, neither], f).map((d) => d.id),
    [1, 2],
  );
});

test("dietary chips OR within the group — vegetarian OR chicken is not the empty set", () => {
  const veg = dish({ id: 1, isVeg: true });
  const chicken = dish({ id: 2, isVeg: false, ingredients: ["Chicken thigh"] });
  const fish = dish({ id: 3, isVeg: false, ingredients: ["Salmon"] });

  const f = filters({ dietary: ["vegetarian", "chicken"] });
  assert.deepEqual(
    filterDishes([veg, chicken, fish], f).map((d) => d.id),
    [1, 2],
  );
});

test("allergen exclusions AND — selecting two excludes dishes carrying EITHER", () => {
  const clean = dish({ id: 1 });
  const peanut = dish({ id: 2, allergens: ["Peanuts"] });
  const gluten = dish({ id: 3, allergens: ["Contains gluten"] });

  const f = filters({ allergen: ["peanut_free", "gluten_free"] });
  assert.deepEqual(
    filterDishes([clean, peanut, gluten], f).map((d) => d.id),
    [1],
    "a dish carrying either excluded allergen must not survive",
  );
});

test("allergen matching is substring and case-insensitive across allergens AND ingredients", () => {
  // Real catalogs carry free text: "Peanuts", "peanut oil", "Groundnut".
  const viaAllergen = dish({ id: 1, allergens: ["PEANUTS"] });
  const viaIngredient = dish({ id: 2, ingredients: ["Cold-pressed groundnut oil"] });
  const f = filters({ allergen: ["peanut_free"] });
  assert.equal(dishMatchesFilters(viaAllergen, f), false);
  assert.equal(dishMatchesFilters(viaIngredient, f), false);
});

test("macro constraints AND — under-400 plus 30g protein requires both", () => {
  const both = dish({ id: 1, macros: { protein: 35, carbs: 20, fiber: 2, calories: 380 } });
  const onlyKcal = dish({ id: 2, macros: { protein: 12, carbs: 20, fiber: 2, calories: 380 } });
  const onlyProtein = dish({ id: 3, macros: { protein: 35, carbs: 20, fiber: 2, calories: 600 } });

  const f = filters({ macro: ["under_400_kcal", "protein_30_plus"] });
  assert.deepEqual(
    filterDishes([both, onlyKcal, onlyProtein], f).map((d) => d.id),
    [1],
  );
});

test("groups compose with AND across each other", () => {
  const target = dish({
    id: 1,
    isVeg: true,
    glycaemicIndex: "low",
    macros: { protein: 32, carbs: 30, fiber: 7, calories: 390 },
  });
  // Same macros but non-veg — fails the dietary group only.
  const wrongDiet = dish({
    id: 2,
    isVeg: false,
    ingredients: ["Chicken"],
    glycaemicIndex: "low",
    macros: { protein: 32, carbs: 30, fiber: 7, calories: 390 },
  });

  const f = filters({
    goal: ["glucose_steady"],
    dietary: ["vegetarian"],
    macro: ["protein_30_plus"],
  });
  assert.deepEqual(
    filterDishes([target, wrongDiet], f).map((d) => d.id),
    [1],
  );
});

test("no_dairy excludes paneer and curd, not just the word dairy", () => {
  const f = filters({ dietary: ["no_dairy"] });
  assert.equal(dishMatchesFilters(dish({ id: 1, ingredients: ["Paneer"] }), f), false);
  assert.equal(dishMatchesFilters(dish({ id: 2, ingredients: ["Curd"] }), f), false);
  assert.equal(dishMatchesFilters(dish({ id: 3, ingredients: ["Quinoa"] }), f), true);
});

test("eggetarian admits vegetarian dishes and egg-bearing ones, not chicken", () => {
  const f = filters({ dietary: ["eggetarian"] });
  assert.equal(dishMatchesFilters(dish({ id: 1, isVeg: true }), f), true);
  assert.equal(
    dishMatchesFilters(dish({ id: 2, isVeg: false, ingredients: ["Boiled egg"] }), f),
    true,
  );
  assert.equal(
    dishMatchesFilters(dish({ id: 3, isVeg: false, ingredients: ["Chicken breast"] }), f),
    false,
  );
});

test("an over-constrained set yields zero dishes — the 14.2 state's trigger", () => {
  const all = [
    dish({ id: 1, macros: { protein: 10, carbs: 60, fiber: 1, calories: 700 } }),
    dish({ id: 2, macros: { protein: 12, carbs: 55, fiber: 2, calories: 650 } }),
  ];
  const f = filters({ macro: ["under_400_kcal", "protein_30_plus", "high_fiber"] });
  assert.deepEqual(filterDishes(all, f), []);
});

test("toggleFilter is immutable and round-trips", () => {
  const once = toggleFilter(EMPTY_FILTERS, "goal", "fat_loss");
  assert.deepEqual(once.goal, ["fat_loss"]);
  assert.deepEqual(EMPTY_FILTERS.goal, [], "the input state must not be mutated");

  const twice = toggleFilter(once, "goal", "fat_loss");
  assert.deepEqual(twice.goal, []);
  assert.notEqual(twice, once);
});

test("activeFilterLabels reports every active chip in group order", () => {
  const f = filters({
    goal: ["fat_loss"],
    dietary: ["vegetarian"],
    allergen: ["peanut_free"],
    macro: ["high_fiber"],
  });
  assert.deepEqual(activeFilterLabels(f), [
    "Fat loss",
    "Vegetarian",
    "Peanut-free",
    "High fiber",
  ]);
  assert.equal(countActiveFilters(f), 4);
});
