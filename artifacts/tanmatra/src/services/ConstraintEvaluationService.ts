import { PlanDraft, PlannedMeal } from "../domain/types";

/**
 * ConstraintEvaluationService - Hard Safety & Allergen Guardrail
 */
export class ConstraintEvaluationService {
  /**
   * Evaluates if a meal is safe for a given draft's hard allergen and ingredient restrictions.
   */
  static isMealSafe(meal: PlannedMeal, draft: PlanDraft): { safe: boolean; reason?: string } {
    const mealTagsLower = meal.clinicalTags.map(t => t.toLowerCase());
    const mealNameLower = meal.name.toLowerCase();

    // 1. Check Hard Allergens
    for (const allergen of draft.allergenExclusions) {
      const allergenLower = allergen.toLowerCase();
      if (mealTagsLower.includes(allergenLower) || mealNameLower.includes(allergenLower)) {
        return { safe: false, reason: `Violates hard allergen restriction: ${allergen}` };
      }
    }

    // 2. Check Hard Ingredient Exclusions
    for (const exclusion of draft.hardIngredientExclusions) {
      const exclusionLower = exclusion.toLowerCase();
      if (mealTagsLower.includes(exclusionLower) || mealNameLower.includes(exclusionLower)) {
        return { safe: false, reason: `Violates hard ingredient exclusion: ${exclusion}` };
      }
    }

    return { safe: true };
  }

  /**
   * Filters a list of candidate meals against a draft's safety constraints.
   */
  static filterSafeMeals(candidates: PlannedMeal[], draft: PlanDraft): PlannedMeal[] {
    return candidates.filter(meal => this.isMealSafe(meal, draft).safe);
  }
}
