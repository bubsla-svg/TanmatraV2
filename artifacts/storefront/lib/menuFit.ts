/**
 * Menu personalisation — pure fit scoring + ranking. Runs the SAME shared
 * evaluator the server checkout safety gate uses (evaluateDishForPreferences
 * from @workspace/preferences-match, soft/browse mode), so what the menu flags
 * can never disagree with what checkout enforces. Network-free + deterministic
 * → unit-tested (menuFit.test.ts). The client overlay (PersonalizedMenu) is the
 * only caller.
 */
import {
  evaluateDishForPreferences,
  type BlockReason,
  type DishForMatch,
  type PreferencesForMatch,
} from "@workspace/preferences-match";

export type FitBand = "conflict" | "high" | "moderate" | "neutral";

export interface DishFit {
  band: FitBand;
  /** For a conflict, the short reason shown on the card. An allergen match is
   *  the safety headline — it NAMES the specific allergen(s) the customer
   *  listed ("Contains Peanuts"); otherwise the diet/health reason. Undefined
   *  for non-conflicts. */
  conflictLabel?: string;
}

/** Whether a preferences profile carries any signal worth personalising
 *  against. An all-default profile (omnivore, nothing listed, no weight/muscle
 *  goal) produces nothing useful, so the menu is left in its server order. */
export function isMeaningful(prefs: PreferencesForMatch | null): boolean {
  if (!prefs) return false;
  return (
    (prefs.allergens?.length ?? 0) > 0 ||
    (prefs.dislikedIngredients?.length ?? 0) > 0 ||
    (prefs.cuisines?.length ?? 0) > 0 ||
    (prefs.medicalConditions?.length ?? 0) > 0 ||
    prefs.dietaryStyle !== "omnivore" ||
    prefs.goal === "lose_weight" ||
    prefs.goal === "gain_muscle"
  );
}

function titleCase(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export function computeDishFit(dish: DishForMatch, prefs: PreferencesForMatch): DishFit {
  const m = evaluateDishForPreferences(dish, prefs);
  if (m.blocked) {
    // Allergen match is the safety headline — name the specific allergen(s).
    if (m.matchedAllergens.length > 0) {
      return { band: "conflict", conflictLabel: `Contains ${m.matchedAllergens.map(titleCase).join(", ")}` };
    }
    if (m.blockReasons.some((r) => r.code === "macros_pending")) {
      return { band: "conflict", conflictLabel: "Nutrition info pending" };
    }
    if (m.matchedContraindications.length > 0) {
      return { band: "conflict", conflictLabel: "Not suited to your health profile" };
    }
    const diet = m.blockReasons.find(
      (r): r is Extract<BlockReason, { code: "diet_block" }> => r.code === "diet_block",
    );
    return { band: "conflict", conflictLabel: diet?.detail ?? "Doesn't match your preferences" };
  }
  // Positive bands mirror the server's /menu/ranked logic exactly.
  const goalMatch =
    (prefs.goal === "lose_weight" && dish.macros.calories <= 450) ||
    (prefs.goal === "gain_muscle" && dish.macros.protein >= 25);
  if (goalMatch && m.warnings.length === 0) return { band: "high" };
  if (m.cuisineMatch || m.reasons.length > 0) return { band: "moderate" };
  return { band: "neutral" };
}

const BAND_ORDER: Record<FitBand, number> = { high: 0, moderate: 1, neutral: 2, conflict: 3 };

/**
 * Rank best-fit first; allergen/diet conflicts sink to the BOTTOM but are never
 * hidden — the customer must be able to see and understand each flag. Stable
 * within a band (the server's curated order is preserved there).
 */
export function rankDishes(
  dishes: DishForMatch[],
  prefs: PreferencesForMatch,
): Array<{ dish: DishForMatch; fit: DishFit }> {
  return dishes
    .map((dish, i) => ({ dish, fit: computeDishFit(dish, prefs), i }))
    .sort((a, b) => BAND_ORDER[a.fit.band] - BAND_ORDER[b.fit.band] || a.i - b.i)
    .map(({ dish, fit }) => ({ dish, fit }));
}
