// isCareConditionKnown — the clinical-copy gate for /care/[condition]
// (reconciliation sweep, DEF-RECON-CARECONDITION-001). Run:
// node --test --import tsx ./lib/careConditions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { CARE_CONDITIONS, isCareConditionKnown } from "./careConditions";

test("every condition in the allowlist is recognized", () => {
  for (const c of CARE_CONDITIONS) {
    assert.equal(isCareConditionKnown(c.slug), true, c.slug);
  }
});

test("an arbitrary or unmapped slug is not known", () => {
  assert.equal(isCareConditionKnown("asdfqwerty"), false);
  assert.equal(isCareConditionKnown("keto"), false);
  assert.equal(isCareConditionKnown(""), false);
});

test("is case-insensitive and trims whitespace, matching conditionDisplayName's normalization", () => {
  assert.equal(isCareConditionKnown("PCOS"), true);
  assert.equal(isCareConditionKnown("  pcos  "), true);
  assert.equal(isCareConditionKnown("Gerd"), true);
});
