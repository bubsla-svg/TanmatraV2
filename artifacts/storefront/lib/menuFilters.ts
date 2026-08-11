/**
 * Menu filter model (Stitch 5.3 "Filter meals" sheet + 14.2 no-match state).
 *
 * Pure and DOM-free on purpose, exactly like `dietFilter.ts`/`menuGridState.ts`
 * next door: the sheet is a client island, but WHICH dishes survive a filter set
 * is a data question, so it lives here where `node --test` can pin it without a
 * browser. No `@/` alias imports — `lib/` is loaded directly by the test runner.
 *
 * COMBINATION SEMANTICS (deliberate, and the reason each group is typed
 * separately rather than as one flat chip list):
 *
 *   goal      — OR   these are *selectors*. "Fat loss or High protein" widens.
 *   dietary   — OR   same: "Vegetarian or Chicken" is a broader ask, not a
 *                    contradiction. AND-ing them yields the empty set for every
 *                    pair, since no dish is both vegetarian and chicken.
 *   allergen  — AND  these are *exclusions*. Peanut-free + Gluten-free must
 *                    exclude both, or the sheet would quietly serve a customer
 *                    a dish carrying an allergen they just excluded.
 *   macro     — AND  these are *constraints*. "Under 400 kcal" + "30g+ protein"
 *                    means both, which is what a customer setting two numeric
 *                    bounds means every time.
 *
 * The allergen group's AND is the safety-relevant one and is pinned by test.
 * NOTE the standing boundary: these chips *narrow what is displayed*. They are
 * not a safety gate — the server's `checkoutSafety` allergen assessment remains
 * the only thing that can block an order (see the guest-ack path in
 * AlacarteDetails). A display filter must never be mistaken for that.
 */

/** The subset of a dish this module reads. Structurally satisfied by
 *  `DishForMatch` and by the full `DishData`, so callers pass either. */
export interface DishForFilter {
  id: number;
  isVeg: boolean;
  allergens: string[];
  ingredients: string[];
  glycaemicIndex: "low" | "medium" | "high";
  macros: {
    protein: number;
    carbs: number;
    fiber: number;
    calories: number;
  };
}

export type GoalFilter =
  | "fat_loss"
  | "glucose_steady"
  | "high_protein"
  | "gut_light"
  | "energy_stable";

export type DietaryFilter = "vegetarian" | "eggetarian" | "chicken" | "fish" | "no_dairy";

export type AllergenFilter = "peanut_free" | "gluten_free" | "soy_free";

export type MacroFilter = "under_400_kcal" | "protein_30_plus" | "lower_carb" | "high_fiber";

export interface MenuFilterState {
  goal: GoalFilter[];
  dietary: DietaryFilter[];
  allergen: AllergenFilter[];
  macro: MacroFilter[];
}

export const EMPTY_FILTERS: MenuFilterState = {
  goal: [],
  dietary: [],
  allergen: [],
  macro: [],
};

export interface FilterOption<K> {
  key: K;
  label: string;
}

/** Group labels and chip copy come straight from the approved 5.3 prompt. */
export const GOAL_OPTIONS: FilterOption<GoalFilter>[] = [
  { key: "fat_loss", label: "Fat loss" },
  { key: "glucose_steady", label: "Glucose steady" },
  { key: "high_protein", label: "High protein" },
  { key: "gut_light", label: "Gut light" },
  { key: "energy_stable", label: "Energy stable" },
];

export const DIETARY_OPTIONS: FilterOption<DietaryFilter>[] = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "eggetarian", label: "Eggetarian" },
  { key: "chicken", label: "Chicken" },
  { key: "fish", label: "Fish" },
  { key: "no_dairy", label: "No dairy" },
];

export const ALLERGEN_OPTIONS: FilterOption<AllergenFilter>[] = [
  { key: "peanut_free", label: "Peanut-free" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "soy_free", label: "Soy-free" },
];

export const MACRO_OPTIONS: FilterOption<MacroFilter>[] = [
  { key: "under_400_kcal", label: "Under 400 kcal" },
  { key: "protein_30_plus", label: "30g+ protein" },
  { key: "lower_carb", label: "Lower carb" },
  { key: "high_fiber", label: "High fiber" },
];

/** Numeric thresholds, named rather than inlined so the copy above and the
 *  predicates below can never drift apart silently. */
const FAT_LOSS_MAX_KCAL = 450;
const GUT_LIGHT_MIN_FIBER_G = 5;
const GOAL_HIGH_PROTEIN_MIN_G = 25;
const UNDER_400_KCAL = 400;
const PROTEIN_30_MIN_G = 30;
const LOWER_CARB_MAX_G = 40;
const HIGH_FIBER_MIN_G = 6;

function norm(values: string[]): string {
  return values.join(" ").toLowerCase();
}

/** Allergen tokens are free text across sources ("Peanuts", "peanut oil",
 *  "Contains gluten"), so match on substring rather than equality. */
function carries(dish: DishForFilter, tokens: string[]): boolean {
  const haystack = `${norm(dish.allergens)} ${norm(dish.ingredients)}`;
  return tokens.some((t) => haystack.includes(t));
}

function matchesGoal(dish: DishForFilter, goal: GoalFilter): boolean {
  switch (goal) {
    case "fat_loss":
      return dish.macros.calories <= FAT_LOSS_MAX_KCAL;
    case "glucose_steady":
      return dish.glycaemicIndex === "low";
    case "high_protein":
      return dish.macros.protein >= GOAL_HIGH_PROTEIN_MIN_G;
    case "gut_light":
      return dish.macros.fiber >= GUT_LIGHT_MIN_FIBER_G;
    case "energy_stable":
      return dish.glycaemicIndex !== "high";
  }
}

function matchesDietary(dish: DishForFilter, diet: DietaryFilter): boolean {
  switch (diet) {
    case "vegetarian":
      return dish.isVeg;
    // Eggetarian widens vegetarian by egg — a veg dish always qualifies, and a
    // non-veg dish qualifies only when egg is the animal product present.
    case "eggetarian":
      return dish.isVeg || carries(dish, ["egg"]);
    case "chicken":
      return !dish.isVeg && carries(dish, ["chicken"]);
    case "fish":
      return !dish.isVeg && carries(dish, ["fish", "prawn", "salmon", "tuna"]);
    case "no_dairy":
      return !carries(dish, ["dairy", "milk", "paneer", "cheese", "curd", "yoghurt", "yogurt"]);
  }
}

function matchesAllergen(dish: DishForFilter, excl: AllergenFilter): boolean {
  switch (excl) {
    case "peanut_free":
      return !carries(dish, ["peanut", "groundnut"]);
    case "gluten_free":
      return !carries(dish, ["gluten", "wheat", "barley", "rye", "atta", "maida"]);
    case "soy_free":
      return !carries(dish, ["soy", "soya", "tofu", "edamame"]);
  }
}

function matchesMacro(dish: DishForFilter, macro: MacroFilter): boolean {
  switch (macro) {
    case "under_400_kcal":
      return dish.macros.calories < UNDER_400_KCAL;
    case "protein_30_plus":
      return dish.macros.protein >= PROTEIN_30_MIN_G;
    case "lower_carb":
      return dish.macros.carbs <= LOWER_CARB_MAX_G;
    case "high_fiber":
      return dish.macros.fiber >= HIGH_FIBER_MIN_G;
  }
}

/** True when the dish survives every active group. */
export function dishMatchesFilters(dish: DishForFilter, filters: MenuFilterState): boolean {
  if (filters.goal.length && !filters.goal.some((g) => matchesGoal(dish, g))) return false;
  if (filters.dietary.length && !filters.dietary.some((d) => matchesDietary(dish, d))) return false;
  // AND — every exclusion must hold.
  if (!filters.allergen.every((a) => matchesAllergen(dish, a))) return false;
  if (!filters.macro.every((m) => matchesMacro(dish, m))) return false;
  return true;
}

export function filterDishes<T extends DishForFilter>(
  dishes: T[],
  filters: MenuFilterState,
): T[] {
  if (!isFilterActive(filters)) return dishes;
  return dishes.filter((d) => dishMatchesFilters(d, filters));
}

export function countActiveFilters(filters: MenuFilterState): number {
  return (
    filters.goal.length + filters.dietary.length + filters.allergen.length + filters.macro.length
  );
}

export function isFilterActive(filters: MenuFilterState): boolean {
  return countActiveFilters(filters) > 0;
}

export type FilterGroupKey = keyof MenuFilterState;

/** Immutable toggle — returns a new state, never mutates (house rule). */
export function toggleFilter<K extends FilterGroupKey>(
  filters: MenuFilterState,
  group: K,
  key: MenuFilterState[K][number],
): MenuFilterState {
  const current = filters[group] as MenuFilterState[K][number][];
  const next = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key];
  return { ...filters, [group]: next };
}

/** Human-readable labels for every active chip — powers the 14.2 empty state's
 *  "here is what you asked for" summary, so a dead end always explains itself. */
export function activeFilterLabels(filters: MenuFilterState): string[] {
  const out: string[] = [];
  for (const o of GOAL_OPTIONS) if (filters.goal.includes(o.key)) out.push(o.label);
  for (const o of DIETARY_OPTIONS) if (filters.dietary.includes(o.key)) out.push(o.label);
  for (const o of ALLERGEN_OPTIONS) if (filters.allergen.includes(o.key)) out.push(o.label);
  for (const o of MACRO_OPTIONS) if (filters.macro.includes(o.key)) out.push(o.label);
  return out;
}
