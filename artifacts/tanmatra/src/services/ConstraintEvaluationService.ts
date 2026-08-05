import { PlannedMeal, PlanDraft } from "../domain/types";

export interface MealSafetyResult {
  safe: boolean;
  reason?: string;
  violatingAllergens?: string[];
}

export const ConstraintEvaluationService = {
  isMealSafe(meal: PlannedMeal, draft: PlanDraft): MealSafetyResult {
    const exclusions = (draft.allergenExclusions || []).map((a) => a.toLowerCase().trim());
    const tags = (meal.clinicalTags || []).map((t) => t.toLowerCase().trim());

    const violating: string[] = [];
    for (const exc of exclusions) {
      if (tags.some((tag) => tag.includes(exc) || exc.includes(tag))) {
        violating.push(exc);
      }
    }

    if (violating.length > 0) {
      return {
        safe: false,
        reason: "allergen_exclusion_violated",
        violatingAllergens: violating,
      };
    }

    return {
      safe: true,
    };
  },
};
