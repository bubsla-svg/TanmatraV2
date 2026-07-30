import { test } from "node:test";
import assert from "node:assert/strict";
import { stepLabel } from "./landingCopy";

test("stepLabel numbers steps from the render order, zero-padded", () => {
  assert.equal(stepLabel("Set a company budget", 0).number, "01");
  assert.equal(stepLabel("Your team picks", 1).number, "02");
  assert.equal(stepLabel("One hot drop per floor", 9).number, "10");
});

test("stepLabel strips a middot ordinal so the number is not rendered twice", () => {
  const { number, label } = stepLabel("1 · Set a company budget", 0);
  assert.equal(number, "01");
  assert.equal(label, "Set a company budget");
});

test("stepLabel strips dot, colon, paren and dash ordinals", () => {
  assert.equal(stepLabel("2. Your team picks", 1).label, "Your team picks");
  assert.equal(stepLabel("3: One hot drop", 2).label, "One hot drop");
  assert.equal(stepLabel("4) One hot drop", 3).label, "One hot drop");
  assert.equal(stepLabel("5 – One hot drop", 4).label, "One hot drop");
});

test("stepLabel leaves an unnumbered title untouched", () => {
  assert.equal(stepLabel("Precision delivery", 0).label, "Precision delivery");
});

test("stepLabel ignores the content file's own numbering when it disagrees", () => {
  // Render order is the truth: a content file numbered 1,2,4 must not show a gap.
  assert.equal(stepLabel("4 · Third step", 2).number, "03");
});

test("stepLabel does not strip a leading number that is part of the sentence", () => {
  // No separator after the digits, so it is copy ("3 PM"), not an ordinal.
  assert.equal(stepLabel("3 PM energy dip", 0).label, "3 PM energy dip");
  assert.equal(stepLabel("21 lunches a month", 0).label, "21 lunches a month");
});

test("stepLabel never returns a blank label", () => {
  // Fail-safe: a title that is only an ordinal must not render as an empty row.
  assert.equal(stepLabel("3.", 2).label, "3.");
  assert.equal(stepLabel("", 0).label, "");
});
