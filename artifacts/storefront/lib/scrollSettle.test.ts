import { test } from "node:test";
import assert from "node:assert/strict";
import { beginLayoutSettle, declareAnchoringShift, isAnchoringShift, isLayoutSettling } from "./scrollSettle";

test("a declared anchoring shift matches one delta of that height, either sign, within tolerance", () => {
  declareAnchoringShift(180);
  assert.equal(isAnchoringShift(180, 12), true);
  assert.equal(isAnchoringShift(-180, 12), true);
  assert.equal(isAnchoringShift(171, 12), true);
  // The reader's own 600px wheel in the same instant is NOT the correction.
  assert.equal(isAnchoringShift(600, 12), false);
  assert.equal(isAnchoringShift(5, 12), false);
});

test("a zero or negative height declares nothing", () => {
  declareAnchoringShift(0);
  assert.equal(isAnchoringShift(0, 12), false);
  declareAnchoringShift(-40);
  assert.equal(isAnchoringShift(40, 12), false);
});

test("the shift declaration expires", () => {
  declareAnchoringShift(120, 0);
  assert.equal(isAnchoringShift(120, 12), false);
});

test("the settle window is independent of the shift declaration", () => {
  beginLayoutSettle(0);
  assert.equal(isLayoutSettling(), false);
  beginLayoutSettle(10_000);
  assert.equal(isLayoutSettling(), true);
  declareAnchoringShift(0);
  assert.equal(isAnchoringShift(50, 12), false);
});
