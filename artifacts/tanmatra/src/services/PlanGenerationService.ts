import { PlanDraft, PlannedMeal } from "../domain/types";
import { ConstraintEvaluationService } from "./ConstraintEvaluationService";

/**
 * Sample Catalog of Therapeutic Meals
 */
const CULINARY_CATALOG: PlannedMeal[] = [
  {
    mealId: "m1",
    name: "Golden Glycemic Quinoa Bowl",
    slug: "golden-glycemic-quinoa-bowl",
    imageUrl: "https://picsum.photos/seed/quinoa/800/600",
    calories: 420,
    proteinGrams: 22,
    carbsGrams: 48,
    fatGrams: 14,
    clinicalTags: ["low-gi", "diabetic-friendly", "high-fiber"],
    isLocked: false,
    pricePaise: 29900,
  },
  {
    mealId: "m2",
    name: "Nocturnal Recovery Salmon & Asparagus",
    slug: "nocturnal-recovery-salmon",
    imageUrl: "https://picsum.photos/seed/salmon/800/600",
    calories: 510,
    proteinGrams: 38,
    carbsGrams: 16,
    fatGrams: 26,
    clinicalTags: ["omega-3", "anti-inflammatory", "fish"],
    isLocked: false,
    pricePaise: 44900,
  },
  {
    mealId: "m3",
    name: "Therapeutic Turmeric Dal & Wild Rice",
    slug: "therapeutic-turmeric-dal",
    imageUrl: "https://picsum.photos/seed/dal/800/600",
    calories: 380,
    proteinGrams: 18,
    carbsGrams: 54,
    fatGrams: 9,
    clinicalTags: ["gut-health", "vegan", "low-sodium"],
    isLocked: false,
    pricePaise: 24900,
  },
  {
    mealId: "m4",
    name: "Metabolic Roasted Chicken & Avocado",
    slug: "metabolic-roasted-chicken",
    imageUrl: "https://picsum.photos/seed/chicken/800/600",
    calories: 460,
    proteinGrams: 42,
    carbsGrams: 12,
    fatGrams: 24,
    clinicalTags: ["high-protein", "keto-friendly", "dairy-free"],
    isLocked: false,
    pricePaise: 38900,
  },
  {
    mealId: "m5",
    name: "Clinical Lentil & Spinach Power Salad",
    slug: "clinical-lentil-spinach-power-salad",
    imageUrl: "https://picsum.photos/seed/salad/800/600",
    calories: 340,
    proteinGrams: 16,
    carbsGrams: 42,
    fatGrams: 11,
    clinicalTags: ["iron-rich", "vegan", "low-gi"],
    isLocked: false,
    pricePaise: 22900,
  }
];

export class PlanGenerationService {
  /**
   * Generates a initial safe meal lineup for a plan draft.
   */
  static generateLineup(draft: PlanDraft, mealCount: number = 6): PlanDraft {
    const safeCatalog = ConstraintEvaluationService.filterSafeMeals(CULINARY_CATALOG, draft);
    
    if (safeCatalog.length === 0) {
      return {
        ...draft,
        validationErrors: [{ code: "NO_SAFE_MEALS", message: "No meals match your hard allergen exclusions." }],
      };
    }

    const generatedMeals: PlannedMeal[] = [];
    for (let i = 0; i < mealCount; i++) {
      const template = safeCatalog[i % safeCatalog.length];
      generatedMeals.push({
        ...template,
        mealId: `${template.mealId}_slot_${i + 1}`,
        isLocked: false,
      });
    }

    return {
      ...draft,
      generatedMeals,
      lockedMealIds: [],
      manuallyReplacedMealIds: [],
      previousShuffleSnapshot: undefined,
      unsavedChanges: true,
    };
  }

  /**
   * Shuffles unlocked meals while preserving locked meals and safety rules.
   */
  static shuffle(draft: PlanDraft): PlanDraft {
    const safeCatalog = ConstraintEvaluationService.filterSafeMeals(CULINARY_CATALOG, draft);
    const previousSnapshot = [...draft.generatedMeals];

    const newMeals = draft.generatedMeals.map((existingMeal) => {
      // Rule 7: Locked meals are NEVER changed by Shuffle
      if (existingMeal.isLocked || draft.lockedMealIds.includes(existingMeal.mealId)) {
        return existingMeal;
      }

      // Pick a random alternative safe meal
      const candidates = safeCatalog.filter(c => c.slug !== existingMeal.slug);
      const chosen = candidates.length > 0 
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : existingMeal;

      return {
        ...chosen,
        mealId: existingMeal.mealId,
        isLocked: false,
      };
    });

    return {
      ...draft,
      generatedMeals: newMeals,
      previousShuffleSnapshot: previousSnapshot,
      unsavedChanges: true,
      version: draft.version + 1,
    };
  }

  /**
   * Restores the previous lineup snapshot (Undo).
   */
  static undo(draft: PlanDraft): PlanDraft {
    if (!draft.previousShuffleSnapshot) return draft;

    // Validate that restored meals still satisfy safety
    const safeMeals = draft.previousShuffleSnapshot.map(meal => {
      const check = ConstraintEvaluationService.isMealSafe(meal, draft);
      return check.safe ? meal : draft.generatedMeals.find(g => g.mealId === meal.mealId) || meal;
    });

    return {
      ...draft,
      generatedMeals: safeMeals,
      previousShuffleSnapshot: undefined,
      version: draft.version + 1,
    };
  }

  /**
   * Toggles the lock status of a meal slot (Keep).
   */
  static toggleKeep(draft: PlanDraft, mealId: string): PlanDraft {
    const updatedMeals = draft.generatedMeals.map(m => 
      m.mealId === mealId ? { ...m, isLocked: !m.isLocked } : m
    );

    const lockedIds = updatedMeals.filter(m => m.isLocked).map(m => m.mealId);

    return {
      ...draft,
      generatedMeals: updatedMeals,
      lockedMealIds: lockedIds,
    };
  }

  /**
   * Manually replaces a dish (clears Undo state per Rule 6).
   */
  static replaceDish(draft: PlanDraft, mealId: string, newMealTemplate: PlannedMeal): PlanDraft {
    const check = ConstraintEvaluationService.isMealSafe(newMealTemplate, draft);
    if (!check.safe) {
      throw new Error(`Cannot select dish: ${check.reason}`);
    }

    const updatedMeals = draft.generatedMeals.map(m => 
      m.mealId === mealId ? { ...newMealTemplate, mealId, isLocked: m.isLocked } : m
    );

    return {
      ...draft,
      generatedMeals: updatedMeals,
      manuallyReplacedMealIds: [...draft.manuallyReplacedMealIds, mealId],
      previousShuffleSnapshot: undefined, // Rule 6: Manual replacement clears Undo
      version: draft.version + 1,
    };
  }
}
