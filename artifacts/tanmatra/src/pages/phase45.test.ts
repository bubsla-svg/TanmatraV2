import test from "node:test";
import assert from "node:assert/strict";

import { PlanDraft } from "../domain/types";
import { PlanGenerationService } from "../services/PlanGenerationService";
import { PricingService } from "../services/PricingService";

test("Subscription Discovery & Config: Plan duration discount calculation", () => {
  let draft: PlanDraft = {
    id: "draft_disc_101",
    version: 1,
    type: "recommended",
    currentStage: "configuration",
    servingCount: 1,
    mealSlots: ["lunch"],
    durationDays: 30, // 20% discount
    allergenExclusions: [],
    hardIngredientExclusions: [],
    dislikedIngredients: [],
    generatedMeals: [],
    lockedMealIds: [],
    manuallyReplacedMealIds: [],
    deliveryDates: [],
    entitlementIds: [],
    wearableInfluenceEnabled: false,
    validationErrors: [],
    unsavedChanges: false,
    serviceabilityStatus: "serviceable",
  };

  draft = PlanGenerationService.generateLineup(draft, 6);
  const breakdown30Days = PricingService.calculateBreakdown({ ...draft, durationDays: 30 });
  const breakdown7Days = PricingService.calculateBreakdown({ ...draft, durationDays: 7 });

  // 30 days should apply 20% plan discount
  assert.ok(breakdown30Days.planDiscountPaise > 0);
  assert.equal(breakdown7Days.planDiscountPaise, 0);
});

test("Subscription Config: Day-by-day lineup Keep and Undo state", () => {
  let draft: PlanDraft = {
    id: "draft_lineup_202",
    version: 1,
    type: "recommended",
    currentStage: "lineup",
    servingCount: 1,
    mealSlots: ["lunch"],
    durationDays: 14,
    allergenExclusions: [],
    hardIngredientExclusions: [],
    dislikedIngredients: [],
    generatedMeals: [],
    lockedMealIds: [],
    manuallyReplacedMealIds: [],
    deliveryDates: [],
    entitlementIds: [],
    wearableInfluenceEnabled: false,
    validationErrors: [],
    unsavedChanges: false,
    serviceabilityStatus: "serviceable",
  };

  draft = PlanGenerationService.generateLineup(draft, 6);
  assert.equal(draft.generatedMeals.length, 6);

  // Keep first meal slot
  const firstMealId = draft.generatedMeals[0].mealId;
  draft = PlanGenerationService.toggleKeep(draft, firstMealId);
  assert.equal(draft.generatedMeals[0].isLocked, true);
  assert.ok(draft.lockedMealIds.includes(firstMealId));

  // Shuffle unlocked meals
  const originalName = draft.generatedMeals[0].name;
  draft = PlanGenerationService.shuffle(draft);
  assert.equal(draft.generatedMeals[0].name, originalName);

  // Undo shuffle
  draft = PlanGenerationService.undo(draft);
  assert.equal(draft.previousShuffleSnapshot, undefined);
});
