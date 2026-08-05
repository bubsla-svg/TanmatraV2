import { PlannedMeal, PlanDraft } from "../domain/types";
import { ConstraintEvaluationService } from "./ConstraintEvaluationService";

const CATALOG_MEALS: PlannedMeal[] = [
  {
    mealId: "meal_quinoa_bowl",
    name: "Golden Quinoa & Edamame Protein Bowl",
    slug: "quinoa-edamame-bowl",
    imageUrl: "/images/dishes/quinoa-bowl.jpg",
    calories: 420,
    proteinGrams: 22,
    carbsGrams: 48,
    fatGrams: 12,
    clinicalTags: ["low-gi", "high-protein", "vegan"],
    isLocked: false,
    pricePaise: 29900,
  },
  {
    mealId: "meal_paneer_tikka",
    name: "Smoked Paneer Tikka & Millet Pilaf",
    slug: "smoked-paneer-tikka",
    imageUrl: "/images/dishes/paneer-tikka.jpg",
    calories: 460,
    proteinGrams: 26,
    carbsGrams: 42,
    fatGrams: 16,
    clinicalTags: ["high-protein", "vegetarian", "pcos-friendly"],
    isLocked: false,
    pricePaise: 32900,
  },
  {
    mealId: "meal_lentil_stew",
    name: "Ayurvedic Moringa & Black Lentil Stew",
    slug: "moringa-lentil-stew",
    imageUrl: "/images/dishes/lentil-stew.jpg",
    calories: 380,
    proteinGrams: 18,
    carbsGrams: 52,
    fatGrams: 8,
    clinicalTags: ["anti-inflammatory", "gut-friendly", "vegan"],
    isLocked: false,
    pricePaise: 27900,
  },
  {
    mealId: "meal_chicken_herb",
    name: "Slow-Braised Rosemary Chicken & Roasted Roots",
    slug: "rosemary-braised-chicken",
    imageUrl: "/images/dishes/braised-chicken.jpg",
    calories: 490,
    proteinGrams: 38,
    carbsGrams: 30,
    fatGrams: 14,
    clinicalTags: ["high-protein", "keto-friendly", "poultry"],
    isLocked: false,
    pricePaise: 36900,
  },
  {
    mealId: "meal_tofu_greens",
    name: "Glazed Tofu with Wilted Bok Choy & Black Rice",
    slug: "glazed-tofu-bok-choy",
    imageUrl: "/images/dishes/glazed-tofu.jpg",
    calories: 410,
    proteinGrams: 24,
    carbsGrams: 44,
    fatGrams: 11,
    clinicalTags: ["low-gi", "plant-based", "vegan"],
    isLocked: false,
    pricePaise: 29900,
  },
  {
    mealId: "meal_salmon_greens",
    name: "Wild Salmon with Asparagus & Citrus Emulsion",
    slug: "wild-salmon-asparagus",
    imageUrl: "/images/dishes/salmon.jpg",
    calories: 520,
    proteinGrams: 36,
    carbsGrams: 18,
    fatGrams: 22,
    clinicalTags: ["fish", "omega-3", "cardio-friendly"],
    isLocked: false,
    pricePaise: 49900,
  },
];

export const PlanGenerationService = {
  generateLineup(draft: PlanDraft, count: number = 6): PlanDraft {
    const safePool = CATALOG_MEALS.filter((meal) =>
      ConstraintEvaluationService.isMealSafe(meal, draft).safe
    );

    const generated: PlannedMeal[] = [];
    for (let i = 0; i < count; i++) {
      const template = safePool[i % safePool.length] || CATALOG_MEALS[0];
      generated.push({
        ...template,
        mealId: `${template.mealId}_slot_${i + 1}`,
        isLocked: false,
      });
    }

    return {
      ...draft,
      generatedMeals: generated,
      lockedMealIds: [],
    };
  },

  toggleKeep(draft: PlanDraft, mealId: string): PlanDraft {
    const updatedMeals = draft.generatedMeals.map((m) => {
      if (m.mealId === mealId) {
        return { ...m, isLocked: !m.isLocked };
      }
      return m;
    });

    const lockedIds = updatedMeals.filter((m) => m.isLocked).map((m) => m.mealId);

    return {
      ...draft,
      generatedMeals: updatedMeals,
      lockedMealIds: lockedIds,
    };
  },

  shuffle(draft: PlanDraft): PlanDraft {
    const safePool = CATALOG_MEALS.filter((meal) =>
      ConstraintEvaluationService.isMealSafe(meal, draft).safe
    );

    const snapshot = [...draft.generatedMeals];

    const shuffled = draft.generatedMeals.map((m, idx) => {
      if (m.isLocked) {
        return m;
      }
      // Pick a different safe meal
      const offset = (idx + 1) % safePool.length;
      const candidate = safePool[offset] || m;
      return {
        ...candidate,
        mealId: m.mealId,
        isLocked: false,
      };
    });

    return {
      ...draft,
      generatedMeals: shuffled,
      previousShuffleSnapshot: snapshot,
    };
  },

  undo(draft: PlanDraft): PlanDraft {
    if (!draft.previousShuffleSnapshot) {
      return draft;
    }

    return {
      ...draft,
      generatedMeals: [...draft.previousShuffleSnapshot],
      previousShuffleSnapshot: undefined,
    };
  },
};
