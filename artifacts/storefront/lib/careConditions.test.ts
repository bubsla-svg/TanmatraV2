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

// lib/nav.ts links /care/diabetes (not /care/type-2-diabetes) from its Plan
// group, and e2e/specs/stitch-runtime/clinical.spec.ts asserts that exact
// route renders the clinical-protocol framing — the short slug must resolve
// as known even though it isn't CARE_CONDITIONS' own spelling.
test("the 'diabetes' alias used by nav.ts and the 11.4 e2e spec is recognized", () => {
  assert.equal(isCareConditionKnown("diabetes"), true);
  assert.equal(isCareConditionKnown("Diabetes"), true);
});
