// ─────────────────────────────────────────────────────────────────────────────
// Dish-data integrity checks (publish gate).
//
// A clinical nutrition-therapy product cannot ship contradictory allergen /
// diet / serving data on the consumer surface. This module is the single source
// of truth for the "can this dish be published?" rules. It is consumed by:
//   - the CI gate `scripts/src/verify-dish-integrity.ts` (fails the build on any
//     violation across the whole catalog), and
//   - anywhere a CMS/ops editor validates a dish before saving.
//
// Each rule below traces to a real production defect: a dish named "Eggless"
// that declared an Eggs allergen with no egg in its ingredients and was tagged
// Non-Veg — four mutually-exclusive signals on one allergen card.
// ─────────────────────────────────────────────────────────────────────────────

import type { DishData } from "./index";
import { getServeMode } from "./index";

export interface DishIntegrityViolation {
  slug: string;
  /** Stable machine code for grouping/reporting. */
  code: string;
  message: string;
}

// Standalone "egg" / "eggs" only — the trailing boundary excludes "eggless"
// and "eggplant" so those never trip the egg detectors.
const EGG_WORD_RE = /\begg(?:s)?\b/i;

// Ingredient tokens that make a dish non-vegetarian (Indian veg convention:
// egg is non-veg; dairy is veg-compatible and deliberately excluded here).
const NONVEG_INGREDIENT_RE =
  /\b(?:chicken|mutton|lamb|beef|pork|bacon|ham|fish|prawns?|shrimp|crab|meat|tuna|salmon|anchov(?:y|ies)|egg(?:s)?)\b/i;

// Ingredient tokens that imply gluten (used only for the "gluten-free" name gate).
const GLUTEN_INGREDIENT_RE =
  /\b(?:wheat|maida|barley|rye|semolina|spaghetti|penne|fettuccine|pasta|bread|tortilla|pita|nachos?|crouton|naan|roti|bun)\b/i;

const NONVEG_ALLERGENS = new Set(["egg", "eggs", "fish", "shellfish", "crustacean", "crustaceans"]);

// Word-boundary term matcher (optional plural). Self-contained on purpose: this
// module must never import the preferences matcher, which depends on THIS
// package — pulling it back in would create an import cycle.
function ingredientHasTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, "i").test(text);
}

// Unambiguous ingredient → allergen-family signals. Deliberately conservative:
// only tokens whose presence reliably implies the family, so "coconut milk",
// "peanut butter", or "rice flour" never trip the wrong one. Egg is handled
// explicitly (in BOTH directions) by the checks above; these families are
// gated in the hazard direction only — an undeclared allergen-bearing
// ingredient. The reverse (a declared allergen whose source is a processed
// item like "nutella"/"nachos" with no literal token) is too noisy to gate.
const ALLERGEN_FAMILY_SIGNALS: {
  family: string;
  /** allergen-array tokens (lowercased) that satisfy the declaration. */
  allergenTokens: string[];
  /** ingredient/description terms that unambiguously imply the family. */
  ingredientTerms: string[];
}[] = [
  { family: "Dairy", allergenTokens: ["dairy", "milk", "lactose"], ingredientTerms: ["paneer", "ghee", "cheese", "curd", "yogurt", "yoghurt", "khoya", "buttermilk", "mozzarella", "parmesan", "ricotta", "mascarpone"] },
  { family: "Tree nuts", allergenTokens: ["tree nuts", "tree nut", "nuts", "nut"], ingredientTerms: ["almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "macadamia"] },
  { family: "Peanuts", allergenTokens: ["peanuts", "peanut", "groundnut", "groundnuts", "nuts", "nut"], ingredientTerms: ["peanut", "groundnut"] },
  { family: "Gluten", allergenTokens: ["gluten", "wheat"], ingredientTerms: ["wheat", "maida", "barley", "rye", "semolina", "seitan", "couscous"] },
  { family: "Soy", allergenTokens: ["soy", "soya"], ingredientTerms: ["tofu", "edamame", "soybean", "soybeans", "tempeh", "soya"] },
  { family: "Shellfish", allergenTokens: ["shellfish", "crustacean", "crustaceans"], ingredientTerms: ["shrimp", "prawn", "crab", "lobster", "mussel", "clam", "oyster", "squid", "calamari"] },
  { family: "Fish", allergenTokens: ["fish"], ingredientTerms: ["salmon", "tuna", "cod", "trout", "anchovy", "anchovies", "mackerel", "sardine", "basa"] },
  { family: "Sesame", allergenTokens: ["sesame"], ingredientTerms: ["sesame", "tahini"] },
];

function lc(values: readonly string[]): string[] {
  return values.map((v) => v.toLowerCase().trim());
}

/**
 * Return every integrity violation for a single dish. Empty array == publishable.
 * Pure and side-effect free so it is safe to call from the gate, tests, or a CMS
 * save handler.
 */
export function findDishIntegrityViolations(dish: DishData): DishIntegrityViolation[] {
  const out: DishIntegrityViolation[] = [];
  const push = (code: string, message: string) => out.push({ slug: dish.slug, code, message });

  const nameTokens = `${dish.name} ${dish.slug}`.toLowerCase();
  // Ingredient evidence text deliberately EXCLUDES the name so a marketing
  // token like "Eggless" in the title never counts as an egg ingredient.
  const ingredientText = `${(dish.ingredients ?? []).join(" ")} ${dish.longDescription ?? ""}`;
  const allergens = lc(dish.allergens ?? []);

  const hasEggAllergen = allergens.includes("egg") || allergens.includes("eggs");
  const hasEggIngredient = EGG_WORD_RE.test(ingredientText);

  // 1. Name-token claims must not be contradicted by the structured data.
  if (/eggless/.test(nameTokens)) {
    if (hasEggAllergen) {
      push("eggless_name_vs_egg_allergen", `"${dish.name}" is named eggless but declares an Eggs allergen.`);
    }
    if (hasEggIngredient) {
      push("eggless_name_vs_egg_ingredient", `"${dish.name}" is named eggless but lists egg in its ingredients.`);
    }
  }
  if (/\bvegan\b/.test(nameTokens)) {
    if (!dish.isVeg) {
      push("vegan_name_vs_nonveg_flag", `"${dish.name}" is named vegan but is flagged Non-Veg.`);
    }
    if (allergens.includes("dairy") || hasEggAllergen) {
      push("vegan_name_vs_animal_allergen", `"${dish.name}" is named vegan but declares a dairy/egg allergen.`);
    }
  }
  if (/gluten[-\s]?free/.test(nameTokens)) {
    if (allergens.includes("gluten")) {
      push("glutenfree_name_vs_gluten_allergen", `"${dish.name}" is named gluten-free but declares a Gluten allergen.`);
    }
    if (GLUTEN_INGREDIENT_RE.test(ingredientText)) {
      push("glutenfree_name_vs_gluten_ingredient", `"${dish.name}" is named gluten-free but lists a gluten-bearing ingredient.`);
    }
  }

  // 2. Egg allergen and egg ingredients must agree in BOTH directions.
  //    Over-declaration erodes trust; under-declaration is an allergen hazard.
  if (hasEggAllergen && !hasEggIngredient) {
    push("egg_allergen_without_ingredient", `"${dish.name}" declares an Eggs allergen but no egg appears in its ingredients.`);
  }
  if (hasEggIngredient && !hasEggAllergen) {
    push("egg_ingredient_without_allergen", `"${dish.name}" lists egg in its ingredients but does not declare the Eggs allergen.`);
  }

  // 3. The veg flag must agree with the actual ingredients/allergens.
  const nonVegByIngredient = NONVEG_INGREDIENT_RE.test(ingredientText);
  const nonVegByAllergen = allergens.some((a) => NONVEG_ALLERGENS.has(a));
  const hasNonVegSignal = nonVegByIngredient || nonVegByAllergen;
  if (dish.isVeg && hasNonVegSignal) {
    push("veg_flag_vs_nonveg_signal", `"${dish.name}" is flagged Veg but contains a non-veg signal (egg/meat/fish/shellfish).`);
  }
  if (!dish.isVeg && !hasNonVegSignal) {
    push("nonveg_flag_without_signal", `"${dish.name}" is flagged Non-Veg but has no egg/meat/fish/shellfish signal in its data.`);
  }

  // 4. Serving mode must never tell a cold/raw item to be heated.
  const mode = getServeMode(dish);
  if ((dish.category === "beverages" || dish.category === "salads") && mode === "reheat") {
    push("cold_category_reheat_mode", `"${dish.name}" is a ${dish.category} item but resolves to a "reheat" serving mode.`);
  }

  // 5. Every unambiguous allergen-bearing ingredient must be declared. This is
  //    the dangerous direction: a nut / dairy / shellfish / gluten source in the
  //    recipe that is missing from the allergen card can send an allergic
  //    customer a dish that will hurt them. (Egg is covered in both directions
  //    above.) Checked in the hazard direction only — see ALLERGEN_FAMILY_SIGNALS.
  for (const fam of ALLERGEN_FAMILY_SIGNALS) {
    const declared = fam.allergenTokens.some((t) => allergens.includes(t));
    if (declared) continue;
    const hit = fam.ingredientTerms.find((t) => ingredientHasTerm(ingredientText, t));
    if (hit) {
      push(
        "undeclared_allergen_ingredient",
        `"${dish.name}" lists ${hit} (a ${fam.family} source) but does not declare the ${fam.family} allergen.`,
      );
    }
  }

  return out;
}

/** Flatten violations across a catalog. Empty array == the whole catalog is publishable. */
export function findCatalogIntegrityViolations(dishes: readonly DishData[]): DishIntegrityViolation[] {
  return dishes.flatMap((d) => findDishIntegrityViolations(d));
}
