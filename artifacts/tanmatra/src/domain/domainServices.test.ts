import test from "node:test";
import assert from "node:assert/strict";

import { PlanDraft } from "./types";
import { PricingService } from "../services/PricingService";
import { ConstraintEvaluationService } from "../services/ConstraintEvaluationService";
import { PlanGenerationService } from "../services/PlanGenerationService";
import { CheckoutService } from "../services/CheckoutService";
import { VocabularySanitizer } from "./quarantine";

test("VocabularySanitizer purges banned aggregator terms", () => {
  const result = VocabularySanitizer.validate("Pick a restaurant near you");
  assert.equal(result.isValid, false);
  assert.equal(result.violation, "pick a restaurant");

  const sanitized = VocabularySanitizer.sanitize("Select a restaurant for your plan");
  assert.equal(sanitized.includes("restaurant"), false);
  assert.equal(sanitized.includes("Therapeutic Kitchen"), true);
});

test("ConstraintEvaluationService enforces hard allergen exclusions", () => {
  const draft: PlanDraft = {
    id: "draft_123",
    version: 1,
    type: "recommended",
    currentStage: "preferences",
    servingCount: 1,
    mealSlots: ["lunch", "dinner"],
    allergenExclusions: ["fish", "shellfish"],
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
  };

  const safeMeal = {
    mealId: "m1",
    name: "Quinoa Bowl",
    slug: "quinoa-bowl",
    imageUrl: "",
    calories: 400,
    proteinGrams: 20,
    carbsGrams: 50,
    fatGrams: 10,
    clinicalTags: ["low-gi"],
    isLocked: false,
    pricePaise: 25000,
  };

  const allergenMeal = {
    mealId: "m2",
    name: "Salmon Meal",
    slug: "salmon-meal",
    imageUrl: "",
    calories: 500,
    proteinGrams: 35,
    carbsGrams: 20,
    fatGrams: 20,
    clinicalTags: ["fish", "omega-3"],
    isLocked: false,
    pricePaise: 45000,
  };

  assert.equal(ConstraintEvaluationService.isMealSafe(safeMeal, draft).safe, true);
  assert.equal(ConstraintEvaluationService.isMealSafe(allergenMeal, draft).safe, false);
});

test("PlanGenerationService handles Keep, Shuffle, and Undo", () => {
  let draft: PlanDraft = {
    id: "draft_456",
    version: 1,
    type: "recommended",
    currentStage: "lineup",
    servingCount: 1,
    mealSlots: ["lunch"],
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
  };

  // Generate initial lineup
  draft = PlanGenerationService.generateLineup(draft, 4);
  assert.equal(draft.generatedMeals.length, 4);

  // Lock first meal (Keep)
  const firstMealId = draft.generatedMeals[0].mealId;
  draft = PlanGenerationService.toggleKeep(draft, firstMealId);
  assert.equal(draft.generatedMeals[0].isLocked, true);

  // Shuffle unlocked meals
  const initialFirstMealName = draft.generatedMeals[0].name;
  draft = PlanGenerationService.shuffle(draft);
  
  // Rule 7: Locked meal remains unchanged
  assert.equal(draft.generatedMeals[0].name, initialFirstMealName);
  assert.notEqual(draft.previousShuffleSnapshot, undefined);

  // Undo
  draft = PlanGenerationService.undo(draft);
  assert.equal(draft.previousShuffleSnapshot, undefined);
});

test("PricingService computes authoritative price in paise and generates quote", () => {
  let draft: PlanDraft = {
    id: "draft_789",
    version: 1,
    type: "recommended",
    currentStage: "lineup",
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
    serviceabilityStatus: "serviceable"
  };

  draft = PlanGenerationService.generateLineup(draft, 4);
  const quote = PricingService.generateQuote(draft);

  assert.equal(quote.status, "active");
  assert.equal(quote.currency, "INR");
  assert.ok(quote.priceBreakdown.chargePaise > 0);
  assert.ok(quote.priceBreakdown.planDiscountPaise > 0);
});

test("CheckoutService enforces idempotency for payment attempts", () => {
  let draft: PlanDraft = {
    id: "draft_999",
    version: 1,
    type: "recommended",
    currentStage: "checkout",
    servingCount: 1,
    mealSlots: ["lunch"],
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
  };

  draft = PlanGenerationService.generateLineup(draft, 2);
  const quote = PricingService.generateQuote(draft);

  const idempotencyKey = "key_tx_12345";
  const attempt1 = CheckoutService.createPaymentAttempt(quote, idempotencyKey);
  const attempt2 = CheckoutService.createPaymentAttempt(quote, idempotencyKey);

  // Same idempotency key must return exact same payment attempt
  assert.equal(attempt1.paymentAttemptId, attempt2.paymentAttemptId);

  // Order creation
  const order = CheckoutService.confirmPaymentAndCreateOrder(attempt1.paymentAttemptId);
  assert.equal(order.status, "confirmed");
  assert.equal(order.quoteId, quote.quoteId);
});
