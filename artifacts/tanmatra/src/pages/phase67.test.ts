import test from "node:test";
import assert from "node:assert/strict";

import { PlanDraft } from "../domain/types";
import { PlanGenerationService } from "../services/PlanGenerationService";
import { PricingService } from "../services/PricingService";
import { CheckoutService } from "../services/CheckoutService";

test("Phase 6 Custom Build: Generation with hard allergen exclusions", () => {
  const draft: PlanDraft = {
    id: "custom_draft_test_1",
    version: 1,
    type: "custom",
    currentStage: "questionnaire",
    servingCount: 1,
    mealSlots: ["lunch", "dinner"],
    durationDays: 30,
    allergenExclusions: ["shellfish"],
    hardIngredientExclusions: [],
    dislikedIngredients: [],
    generatedMeals: [],
    lockedMealIds: [],
    manuallyReplacedMealIds: [],
    deliveryDates: [],
    entitlementIds: [],
    wearableInfluenceEnabled: false,
    validationErrors: [],
    unsavedChanges: true,
    serviceabilityStatus: "serviceable",
  };

  const generated = PlanGenerationService.generateLineup(draft, 6);
  assert.equal(generated.generatedMeals.length, 6);

  // Assert zero shellfish meals present
  for (const meal of generated.generatedMeals) {
    assert.equal(meal.clinicalTags.includes("shellfish"), false);
  }
});

test("Phase 7 Checkout: Quote consumption and idempotent order creation", () => {
  const draft = PlanGenerationService.generateLineup({
    id: "chk_test_draft_2",
    version: 1,
    type: "recommended",
    currentStage: "checkout",
    servingCount: 1,
    mealSlots: ["lunch"],
    durationDays: 30,
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
    serviceabilityStatus: "serviceable"
  }, 4);

  const quote = PricingService.generateQuote(draft);
  assert.equal(quote.status, "active");

  const idempotencyKey = `tx_key_p7_${Date.now()}`;
  const attempt1 = CheckoutService.createPaymentAttempt(quote, idempotencyKey);
  const attempt2 = CheckoutService.createPaymentAttempt(quote, idempotencyKey);

  // Idempotency: exact same payment attempt returned
  assert.equal(attempt1.paymentAttemptId, attempt2.paymentAttemptId);

  // Order creation
  const order = CheckoutService.confirmPaymentAndCreateOrder(attempt1.paymentAttemptId);
  assert.equal(order.status, "confirmed");
  assert.equal(order.quoteId, quote.quoteId);
});
