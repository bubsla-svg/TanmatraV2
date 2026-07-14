import type { DishData } from "@workspace/menu-catalog";

export type DietaryStyle =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto";

export type WellnessGoal =
  | "lose_weight"
  | "maintain"
  | "gain_muscle"
  | "general_wellness";

/**
 * Minimal preference shape needed by the dish evaluator. Both the client
 * (`UserPreferences` from preferencesApi) and the server (the
 * `userPreferencesTable` row from `@workspace/db`) satisfy this contract.
 */
export interface PreferencesForMatch {
  allergens: string[];
  dislikedIngredients: string[];
  cuisines: string[];
  dietaryStyle: DietaryStyle;
  goal?: WellnessGoal | null;
  calorieTarget?: number | null;
  medicalConditions?: string[];
}

export interface DishMatchResult {
  blocked: boolean;
  /** Why this dish was blocked. Empty when `blocked === false`. */
  blockReasons: BlockReason[];
  warnings: string[];
  reasons: string[];
  matchedAllergens: string[];
  matchedDislikes: string[];
  matchedContraindications: string[];
  cuisineMatch: boolean;
}

/** Discriminator for server-side 422 responses + audit logs. */
export type BlockReason =
  | { code: "allergen_block"; allergens: string[] }
  | { code: "contraindication_block"; conditions: string[]; detail: string }
  | { code: "diet_block"; style: DietaryStyle; detail: string }
  | { code: "ingredient_block"; ingredients: string[] }
  | { code: "keto_block"; carbs: number }
  | { code: "unreviewed_dish"; state: string }
  | { code: "unchecked_allergens" }
  | { code: "macros_pending" };

export interface EvaluateOptions {
  /**
   * When true, dietary-soft signals become hard blocks:
   *  - disliked ingredients → `ingredient_block`
   *  - keto carb-cap exceeded → `keto_block`
   *  - dish.rdReviewState other than "reviewed" → `unreviewed_dish`
   *  - dish.allergensReviewed === false → `unchecked_allergens`
   *
   * Server-side checkout always passes `strict: true` so the wire payload
   * a tampered/stale client sent cannot bypass any patient-safety rule.
   * The menu/coach/meal-planner UI uses default (soft) mode so users
   * still see warnings without being completely blocked from browsing.
   */
  strict?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tokenized / word-boundary matching helper that matches `term` (with optional
 * plural `s`/`es` suffixes) against `text` without false positives like
 * "eggplant" or "veggie" matching "egg".
 */
export function matchIngredientTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const cleaned = norm(term);
  if (!cleaned) return false;

  let base = cleaned;
  if (
    base.length > 3 &&
    base.endsWith("s") &&
    !base.endsWith("ss") &&
    !base.endsWith("us") &&
    !base.endsWith("is")
  ) {
    base = base.slice(0, -1);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(base)}(?:s|es)?\\b`, "i");
  return pattern.test(text);
}

function dishAllergens(d: DishData): string[] {
  return d.allergens.map(norm);
}

function dishIngredientText(d: DishData): string {
  return d.ingredients.map(norm).join(" | ");
}

export const ALLERGEN_CLUSTERS: string[][] = [
  ["dairy", "milk", "lactose", "butter", "cheese", "cream", "ghee", "curd", "paneer", "yogurt", "whey", "casein"],
  ["tree nuts", "tree nut", "tree_nuts", "tree_nut", "tree-nuts", "tree-nut", "peanuts", "peanut", "nuts", "nut", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pistachio", "pistachios", "hazelnut", "hazelnuts", "pecan", "pecans", "macadamia", "macadamias", "pine nut", "pine nuts"],
  ["shellfish", "shell fish", "shell_fish", "seafood", "crustaceans", "crustacean", "shrimp", "shrimps", "prawn", "prawns", "crab", "crabs", "lobster", "lobsters", "mussels", "mussel", "clams", "clam", "oyster", "oysters", "squid", "calamari"],
  ["eggs", "egg"],
  ["gluten", "wheat", "barley", "rye", "oats"],
  ["soy", "soya", "soybean", "soybeans", "soy bean", "soy beans", "tofu", "edamame"],
  ["fish", "seafood", "salmon", "tuna", "cod", "trout", "anchovy", "anchovies"],
  ["sesame", "tahini"],
  ["mustard"],
];

export function getEquivalentTerms(term: string): string[] {
  const t = norm(term).replace(/[-_]/g, " ");
  const terms = new Set<string>([norm(term), t]);
  for (const cluster of ALLERGEN_CLUSTERS) {
    if (cluster.includes(norm(term)) || cluster.includes(t)) {
      for (const c of cluster) {
        terms.add(c);
      }
    }
  }
  return Array.from(terms);
}

const NON_VEG_HINTS = [
  "chicken",
  "fish",
  "egg",
  "shrimp",
  "prawn",
  "salmon",
  "tuna",
  "beef",
  "pork",
  "lamb",
  "mutton",
  "bacon",
  "turkey",
];
const ANIMAL_HINTS = [
  ...NON_VEG_HINTS,
  "milk",
  "cheese",
  "paneer",
  "yogurt",
  "butter",
  "ghee",
  "honey",
  "cream",
];
const FISH_OK_HINTS = ["fish", "salmon", "tuna", "shrimp", "prawn"];

const KETO_CARB_CAP_G = 30;

export function evaluateDishForPreferences(
  dish: DishData,
  prefs: PreferencesForMatch | null,
  opts: EvaluateOptions = {},
): DishMatchResult {
  const strict = opts.strict === true;
  const result: DishMatchResult = {
    blocked: false,
    blockReasons: [],
    warnings: [],
    reasons: [],
    matchedAllergens: [],
    matchedDislikes: [],
    matchedContraindications: [],
    cuisineMatch: true,
  };
  // RD-review gate (strict only): a dish whose review state is anything
  // other than "reviewed" cannot be ordered. Legacy dishes (field absent)
  // are treated as reviewed so the existing curated catalog continues to
  // ship; only explicit pending_review/blocked rows are refused.
  if (strict) {
    const state = dish.rdReviewState;
    if (state && state !== "reviewed") {
      result.blocked = true;
      result.blockReasons.push({ code: "unreviewed_dish", state });
      result.warnings.push(`Dish is ${state} — not approved for ordering`);
    }
    // Unchecked allergen data ("None listed in system") must never be treated
    // as "no allergens". An empty allergens array is only safe when it is a
    // reviewed disclosure; when allergensReviewed === false the list is
    // unknown, so the dish is refused regardless of what the buyer declared.
    if (dish.allergensReviewed === false) {
      result.blocked = true;
      result.blockReasons.push({ code: "unchecked_allergens" });
      result.warnings.push(
        "Allergen data has not been reviewed — not approved for ordering",
      );
    }
  }

  // A dish with unresolved placeholder macros (`macrosProvisional`) has no
  // trustworthy nutritional profile. Refuse it in strict mode, or whenever the
  // buyer has declared allergens/medical conditions the engine would otherwise
  // need real macro/ingredient data to screen against.
  if (
    dish.macrosProvisional === true &&
    (strict || (prefs && ((prefs.allergens?.length ?? 0) > 0 || (prefs.medicalConditions?.length ?? 0) > 0)))
  ) {
    result.blocked = true;
    result.blockReasons.push({ code: "macros_pending" });
    result.warnings.push(
      "Nutritional profile pending verification — disabled for health safety",
    );
  }

  if (!prefs) return result;

  const ingText = dishIngredientText(dish);
  const dishNameNorm = dish.name.toLowerCase();

  if (prefs.medicalConditions && prefs.medicalConditions.length > 0) {
    const userConditions = prefs.medicalConditions.map(norm).filter(Boolean);
    const dishContra = (dish.contraindications ?? []).map(norm);
    const matchedConds = new Set<string>();
    const details: string[] = [];

    for (const cond of userConditions) {
      if (dishContra.includes(cond)) {
        matchedConds.add(cond);
        details.push(`Direct contraindication for ${cond}`);
      }
      if (cond === "diabetes") {
        if (dish.glycaemicIndex === "high") {
          matchedConds.add(cond);
          details.push("High glycaemic index dish is contraindicated for diabetes");
        } else if (dish.sugarPerServing && (
          norm(dish.sugarPerServing).includes("high") ||
          parseInt(dish.sugarPerServing, 10) >= 15
        )) {
          matchedConds.add(cond);
          details.push(`High sugar per serving (${dish.sugarPerServing}) is contraindicated for diabetes`);
        }
      }
      if (
        cond === "hypertension" ||
        cond === "high_blood_pressure" ||
        cond === "high blood pressure" ||
        cond === "high-blood-pressure"
      ) {
        const sodiumTerms = [
          "salt",
          "salted",
          "soy sauce",
          "msg",
          "bacon",
          "cured",
          "sodium",
          "high sodium",
          "extra salt",
        ];
        const hasSodiumContra =
          dishContra.includes("hypertension") ||
          dishContra.includes("high_blood_pressure") ||
          dishContra.includes("high blood pressure") ||
          dishContra.includes("high_sodium") ||
          dishContra.includes("high sodium");
        const hasSodiumIng = sodiumTerms.some(
          (t) =>
            matchIngredientTerm(ingText, t) || matchIngredientTerm(dishNameNorm, t)
        );

        if (hasSodiumContra || hasSodiumIng) {
          matchedConds.add(cond);
          if (cond !== "hypertension") matchedConds.add("hypertension");
          details.push("High sodium content is contraindicated for hypertension");
        }
      }
      if (cond === "gerd") {
        if (
          dishContra.includes("gerd") ||
          ["chili", "hot pepper", "jalapeno"].some(
            (t) =>
              matchIngredientTerm(ingText, t) || matchIngredientTerm(dishNameNorm, t)
          )
        ) {
          matchedConds.add("gerd");
          details.push("Spicy/trigger ingredients are contraindicated for GERD");
        }
      }
      if (cond === "kidney_disease" || cond === "renal") {
        if (dishContra.includes("kidney_disease") || dishContra.includes("renal")) {
          matchedConds.add(cond);
          details.push("Dish is contraindicated for kidney disease / renal diet");
        }
      }
      if (cond === "celiac") {
        const celiacTerms = [
          "gluten",
          "wheat",
          "barley",
          "rye",
          "oats",
          "flour",
          "bread",
          "pasta",
        ];
        const hasGlutenAllergen = dishAllergens(dish).some((a) =>
          celiacTerms.some((t) => matchIngredientTerm(a, t) || a === t)
        );
        const hasGlutenIng = celiacTerms.some(
          (t) =>
            matchIngredientTerm(ingText, t) || matchIngredientTerm(dishNameNorm, t)
        );
        if (
          dishContra.includes("celiac") ||
          dishContra.includes("gluten") ||
          hasGlutenAllergen ||
          hasGlutenIng
        ) {
          matchedConds.add("celiac");
          details.push("Gluten content is contraindicated for celiac disease");
        }
      }
      if (cond === "pregnancy") {
        if (dishContra.includes("pregnancy")) {
          matchedConds.add("pregnancy");
          details.push("Dish is contraindicated during pregnancy");
        }
      }
    }

    if (matchedConds.size > 0) {
      const condList = Array.from(matchedConds);
      result.matchedContraindications.push(...condList);
      result.blocked = true;
      const detailStr = details.join("; ");
      result.blockReasons.push({
        code: "contraindication_block",
        conditions: condList,
        detail: detailStr,
      });
      result.warnings.push(
        `Contraindication conflict (${condList.join(", ")}): ${detailStr}`
      );
    }
  }

  const allergens = dishAllergens(dish);
  const userAllergens = prefs.allergens.map(norm).filter(Boolean);

  for (const a of userAllergens) {
    const equivs = getEquivalentTerms(a);
    const matchedInAllergens = allergens.some((da) => equivs.includes(da));
    if (matchedInAllergens) {
      result.matchedAllergens.push(a);
      continue;
    }
    const matchedInIngredients = equivs.some((eq) => {
      if (!eq) return false;
      return (
        matchIngredientTerm(ingText, eq) || matchIngredientTerm(dishNameNorm, eq)
      );
    });
    if (matchedInIngredients) {
      result.matchedAllergens.push(a);
    }
  }

  if (result.matchedAllergens.length > 0) {
    result.blocked = true;
    result.blockReasons.push({
      code: "allergen_block",
      allergens: [...new Set(result.matchedAllergens)],
    });
    result.warnings.push(
      `Contains ${result.matchedAllergens.join(", ")} — flagged in your allergens`,
    );
  }

  const userDislikes = prefs.dislikedIngredients.map(norm).filter(Boolean);
  for (const dis of userDislikes) {
    const equivs = getEquivalentTerms(dis);
    const matchedInAllergens = allergens.some((da) => equivs.includes(da));
    if (matchedInAllergens) {
      result.matchedDislikes.push(dis);
      continue;
    }
    const matchedInIngredients = equivs.some((eq) => {
      if (!eq) return false;
      return (
        matchIngredientTerm(ingText, eq) || matchIngredientTerm(dishNameNorm, eq)
      );
    });
    if (matchedInIngredients) {
      result.matchedDislikes.push(dis);
    }
  }

  if (result.matchedDislikes.length > 0) {
    if (strict) {
      result.blocked = true;
      result.blockReasons.push({
        code: "ingredient_block",
        ingredients: [...new Set(result.matchedDislikes)],
      });
    }
    result.warnings.push(
      `Contains ${result.matchedDislikes.join(", ")} (on your dislikes)`,
    );
  }

  switch (prefs.dietaryStyle) {
    case "vegetarian":
      if (!dish.isVeg) {
        result.blocked = true;
        result.blockReasons.push({
          code: "diet_block",
          style: "vegetarian",
          detail: "Not vegetarian",
        });
        result.warnings.push("Not vegetarian");
      }
      break;
    case "vegan": {
      const animal = ANIMAL_HINTS.find((h) => matchIngredientTerm(ingText, h));
      if (!dish.isVeg || animal) {
        result.blocked = true;
        result.blockReasons.push({
          code: "diet_block",
          style: "vegan",
          detail: animal
            ? `Contains animal product: ${animal}`
            : "Contains animal products",
        });
        result.warnings.push("Contains animal products");
      }
      break;
    }
    case "pescatarian": {
      if (!dish.isVeg) {
        const fishy = FISH_OK_HINTS.some((h) => matchIngredientTerm(ingText, h));
        if (!fishy) {
          result.blocked = true;
          result.blockReasons.push({
            code: "diet_block",
            style: "pescatarian",
            detail: "Pescatarian: only fish/seafood",
          });
          result.warnings.push("Pescatarian: only fish/seafood");
        }
      }
      break;
    }
    case "keto":
      if (dish.macros.carbs > KETO_CARB_CAP_G) {
        if (strict) {
          result.blocked = true;
          result.blockReasons.push({
            code: "keto_block",
            carbs: dish.macros.carbs,
          });
        }
        result.warnings.push(`High carbs (${dish.macros.carbs}g) for keto`);
      }
      break;
    case "omnivore":
      break;
  }

  if (prefs.cuisines.length > 0) {
    result.cuisineMatch = prefs.cuisines
      .map(norm)
      .includes(dish.kitchen.toLowerCase());
  }

  if (prefs.calorieTarget && dish.macros.calories > prefs.calorieTarget * 0.6) {
    result.warnings.push(
      `${dish.macros.calories} kcal is heavy for your daily target`,
    );
  }

  if (prefs.goal === "gain_muscle" && dish.macros.protein < 15) {
    result.warnings.push(
      `Only ${dish.macros.protein}g protein — light for your muscle-gain goal`,
    );
  }
  if (prefs.goal === "lose_weight" && dish.macros.calories > 700) {
    result.warnings.push(
      `${dish.macros.calories} kcal is heavy for your weight-loss goal`,
    );
  }

  if (prefs.cuisines.length > 0 && result.cuisineMatch) {
    result.reasons.push(`${dish.kitchen} is on your cuisine list`);
  }
  if (prefs.goal === "lose_weight" && dish.macros.calories <= 450) {
    result.reasons.push("Light on calories for your weight-loss goal");
  }
  if (prefs.goal === "gain_muscle" && dish.macros.protein >= 25) {
    result.reasons.push(`${dish.macros.protein}g protein supports muscle gain`);
  }

  return result;
}
