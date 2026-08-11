// Condition display-name casing (D-21/D-23).
// Run: node --test --import tsx ./lib/conditionDisplay.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionDisplayName } from "./conditionDisplay";

test("known acronyms get their correct casing, not title-case", () => {
  assert.equal(conditionDisplayName("pcos"), "PCOS");
  assert.equal(conditionDisplayName("gerd"), "GERD");
  assert.equal(conditionDisplayName("glp1"), "GLP-1");
  assert.equal(conditionDisplayName("glp-1"), "GLP-1");
});

test("is case-insensitive and trims whitespace on input", () => {
  assert.equal(conditionDisplayName("PCOS"), "PCOS");
  assert.equal(conditionDisplayName("Pcos"), "PCOS");
  assert.equal(conditionDisplayName("  pcos  "), "PCOS");
});

test("known multi-word clinical terms resolve to their proper display form", () => {
  assert.equal(conditionDisplayName("type-2-diabetes"), "Type 2 Diabetes");
  assert.equal(conditionDisplayName("insulin-resistance"), "Insulin Resistance");
  assert.equal(conditionDisplayName("kidney-disease"), "Kidney Disease");
});

test("an unmapped slug falls back to per-word title case — never a crash", () => {
  assert.equal(conditionDisplayName("some-unmapped-condition"), "Some Unmapped Condition");
  assert.equal(conditionDisplayName("acne"), "Acne");
  assert.equal(conditionDisplayName(""), "");
});
