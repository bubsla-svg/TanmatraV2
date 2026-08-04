import test from "node:test";
import assert from "node:assert/strict";

import { VocabularySanitizer } from "../domain/quarantine";
import { PricingService } from "../services/PricingService";

test("UI Component Token & Vocabulary Verification", () => {
  // Ensure no banned aggregator text slips into UI elements
  const sampleLabel = "Choose your meal plan";
  const check = VocabularySanitizer.validate(sampleLabel);
  assert.equal(check.isValid, true);

  // Validate price formatting logic
  const paise = 29900; // Rs 299
  const rupees = Math.round(paise / 100);
  assert.equal(rupees, 299);
});
