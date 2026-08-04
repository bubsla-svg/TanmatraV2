import test from "node:test";
import assert from "node:assert/strict";

import { WearableConnectionService } from "../services/WearableConnectionService";
import { PartnerVerificationService } from "../services/PartnerVerificationService";
import { VocabularySanitizer } from "../domain/quarantine";

test("Phase 10 Wearables: Connect, Telemetry, and Non-Automated Safeguard", () => {
  // Initial state: disconnected
  assert.equal(WearableConnectionService.getConnectionStatus().status, "disconnected");
  assert.equal(WearableConnectionService.getTelemetrySummary(), null);

  // Connect Apple Health
  const conn = WearableConnectionService.connect("apple-health");
  assert.equal(conn.status, "connected");
  assert.equal(conn.platform, "apple-health");

  // Telemetry check
  const telemetry = WearableConnectionService.getTelemetrySummary();
  assert.notEqual(telemetry, null);
  assert.ok((telemetry?.dailySteps || 0) > 0);

  // Safeguard rule check: recommendation requires explicit user confirmation
  const rec = WearableConnectionService.getExplainableRecommendation();
  assert.notEqual(rec, null);
  assert.equal(rec?.requiresUserConfirmation, true);

  // Disconnect
  WearableConnectionService.disconnect();
  assert.equal(WearableConnectionService.getConnectionStatus().status, "disconnected");
});

test("Phase 11 Partner Verification: Corporate Token & Benefit Resolution", () => {
  const result = PartnerVerificationService.verifyToken("token_corp_google");
  assert.equal(result.isValid, true);
  assert.equal(result.benefit?.partnerName, "Google Corporate Wellness");
  assert.equal(result.benefit?.discountValue, 50);

  const invalidResult = PartnerVerificationService.verifyToken("invalid_fake_token");
  assert.equal(invalidResult.isValid, false);
});

test("Phase 13 Exit Gate: Clean-Slate Vocabulary Sweep across System", () => {
  const cleanTexts = [
    "Choose your meal plan",
    "Recommended for your goal",
    "Meals in this plan",
    "Tanmatra recommendation",
    "RD-reviewed metabolic food"
  ];

  for (const text of cleanTexts) {
    assert.equal(VocabularySanitizer.validate(text).isValid, true);
  }
});
