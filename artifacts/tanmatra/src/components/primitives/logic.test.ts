// Pure-logic tests for the 02f primitives. DB-free; run via the api-server tsx
// loader (the repo's documented runner for @workspace/tanmatra tests):
//   cd artifacts/api-server && node --test --import tsx \
//     ../tanmatra/src/components/primitives/logic.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHIP_GLYPHS,
  chipToneStyle,
  shouldShowMacroNumerals,
  aspectRatioPaddingTop,
  stepDotIndices,
  clampStep,
  PRICE_FONT_SIZE,
} from "./logic.js";

test("chip glyph set is the closed 12-glyph set", () => {
  assert.equal(Object.keys(CHIP_GLYPHS).length, 12);
  // every glyph maps to a phosphor class, no empties
  for (const cls of Object.values(CHIP_GLYPHS)) {
    assert.match(cls, /^ph-[a-z-]+$/);
  }
});

test("chip tones resolve to design-token vars only (no raw hex)", () => {
  const style = chipToneStyle("sage");
  assert.match(style.color, /^var\(--color-/);
  assert.match(style.backgroundColor, /^var\(--color-/);
  // unknown tone falls back to neutral, never throws
  const fallback = chipToneStyle("does-not-exist" as never);
  assert.match(fallback.color, /^var\(--color-/);
});

test("A5 macro gate: numerals only when verified", () => {
  assert.equal(shouldShowMacroNumerals(true), true);
  assert.equal(shouldShowMacroNumerals(false), false);
});

test("aspect-ratio padding reserves the right box (no CLS)", () => {
  assert.equal(aspectRatioPaddingTop("1:1"), "100.0000%");
  assert.equal(aspectRatioPaddingTop("16:9"), "56.2500%");
  assert.equal(aspectRatioPaddingTop("4:3"), "75.0000%");
  // malformed → safe 1:1 default, never NaN
  assert.equal(aspectRatioPaddingTop("garbage"), "100%");
  assert.equal(aspectRatioPaddingTop("0:0"), "100%");
});

test("step dots clamp and index correctly", () => {
  assert.deepEqual(stepDotIndices(3), [0, 1, 2]);
  assert.deepEqual(stepDotIndices(0), []);
  assert.equal(clampStep(2, 3), 2);
  assert.equal(clampStep(9, 3), 3); // over-range clamps to total
  assert.equal(clampStep(0, 3), 1); // under-range clamps to 1
  assert.equal(clampStep(1, 0), 0); // no steps
});

test("price size scale is complete", () => {
  for (const size of ["sm", "md", "lg", "display"] as const) {
    assert.match(PRICE_FONT_SIZE[size], /rem$/);
  }
});
