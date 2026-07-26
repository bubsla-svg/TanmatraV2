/**
 * Smart Meal Recommendations synthesizer (PRD Feature #2 & #6).
 * Translates clinical fit scoring from computeDishFit and nutritional macro ratios
 * into human-readable AI therapeutic reasoning badges without database mutations.
 * Strictly uses relative imports within lib/.
 */
import type { DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "@workspace/preferences-match";
import { computeDishFit, type DishFit } from "./menuFit";

export interface SmartRecommendation {
  dish: DishData;
  fit: DishFit;
  badge: string;
  rationale: string;
  relevanceScore: number;
}

/**
 * Synthesize personalized clinical recommendation reasoning for a dish given user preferences.
 */
export function generateSmartRecommendation(
  dish: DishData,
  prefs: Partial<PreferencesForMatch> & { dietaryStyle?: string; pcosHistory?: boolean; diabetesHistory?: boolean },
): SmartRecommendation {
  const normPrefs: PreferencesForMatch = {
    dietaryStyle: (prefs.dietaryStyle as any) ?? "omnivore",
    cuisines: prefs.cuisines ?? [],
    medicalConditions: prefs.medicalConditions ?? [],
    goal: (prefs.goal as any) ?? "maintenance",
    ...(prefs as any),
    allergens: prefs.allergens ?? [],
    dislikedIngredients: prefs.dislikedIngredients ?? [],
  };
  const fit = computeDishFit(dish, normPrefs);
  let badge = "Therapeutic Select";
  let rationale = "Macro-calibrated by our Registered Dietitians for balanced daily nutrition.";
  let score = 50;

  if (fit.band === "conflict") {
    return {
      dish,
      fit,
      badge: "Contraindicated",
      rationale: fit.conflictLabel ?? "Does not meet your active health safety gates.",
      relevanceScore: -100,
    };
  }

  const protein = dish.macros?.protein ?? 0;
  const fiber = dish.macros?.fiber ?? 0;
  const sugar = (dish.macros as any)?.sugar ?? 0;
  const calories = dish.macros?.calories ?? 0;
  const isPcos = normPrefs.medicalConditions?.includes("pcos") || prefs.pcosHistory === true;
  const isDiabetes = normPrefs.medicalConditions?.includes("diabetes") || prefs.diabetesHistory === true;

  if ((isPcos || isDiabetes) && sugar < 8 && fiber >= 8) {
    badge = "Glycemic Control Select";
    rationale = `Optimal blood sugar stabilization with ${fiber}g fiber and minimal sugars (${sugar}g).`;
    score += 40;
  } else if (normPrefs.goal === "gain_muscle" || protein >= 30) {
    badge = "High Protein Protocol";
    rationale = `Delivers ${protein}g bioavailable protein to fuel muscle hypertrophy and sustained recovery.`;
    score += 35;
  } else if (normPrefs.goal === "lose_weight") {
    if (fiber >= 10 && calories <= 500) {
      badge = "Satiety & Fat-Loss Tuned";
      rationale = `High volume density (${fiber}g fiber) keeping net calories controlled at ${calories} kcal.`;
      score += 35;
    }
  }

  if (fit.band === "high") score += 20;
  else if (fit.band === "moderate") score += 10;

  return {
    dish,
    fit,
    badge,
    rationale,
    relevanceScore: score,
  };
}

/**
 * Rank and synthesize recommendations across an array of menu items.
 * Excludes conflicts by default when filtering for clean consumer recommendations.
 */
export function recommendMenu(
  dishes: DishData[],
  prefs: Partial<PreferencesForMatch> & { dietaryStyle?: string; pcosHistory?: boolean; diabetesHistory?: boolean },
  excludeConflicts = true,
): SmartRecommendation[] {
  const results = dishes.map((d) => generateSmartRecommendation(d, prefs));
  const filtered = excludeConflicts ? results.filter((r) => r.fit.band !== "conflict") : results;
  return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
