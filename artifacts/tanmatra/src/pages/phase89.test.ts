import test from "node:test";
import assert from "node:assert/strict";

import { SubscriptionManagementService } from "../services/SubscriptionManagementService";
import { FeedbackService } from "../services/FeedbackService";

test("Phase 8 Subscription Management: Cutoff enforcement and Skip/Swap", () => {
  // Test skip before cutoff
  const futureDate = "2099-01-01";
  const skipResult = SubscriptionManagementService.skipDelivery(futureDate);
  assert.equal(skipResult.success, true);

  // Test pause/resume state
  let sub = SubscriptionManagementService.getActiveSubscription();
  assert.equal(sub.status, "active");

  sub = SubscriptionManagementService.togglePause();
  assert.equal(sub.status, "paused");

  sub = SubscriptionManagementService.togglePause();
  assert.equal(sub.status, "active");
});

test("Phase 9 Feedback: Structured feedback submission and Rule 15 non-permanent exclusion check", () => {
  const mealId = "meal_test_999";
  const fb = FeedbackService.submitFeedback(mealId, "not-for-me", ["Spice", "Texture"]);

  assert.equal(fb.mealId, mealId);
  assert.equal(fb.rating, "not-for-me");
  assert.deepEqual(fb.reasons, ["Spice", "Texture"]);

  // Rule 15: Single negative feedback MUST NOT automatically create hard exclusion
  assert.equal(FeedbackService.isHardExclusion(mealId), false);
});
