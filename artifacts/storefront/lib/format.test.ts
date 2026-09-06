import test from "node:test";
import assert from "node:assert/strict";
import { formatGrams, formatKcal, formatMacroLine, formatPaise, MACROS_PENDING_LABEL } from "./format";

test("formatPaise renders whole rupees with en-IN grouping", () => {
  assert.equal(formatPaise(18900), "₹189");
  assert.equal(formatPaise(120000), "₹1,200");
  assert.equal(formatPaise(0), "₹0");
});

// ── Macros (N5.7): one dialect, not three ─────────────────────────────────

test("kcal and grams carry their unit, joined by a non-breaking space", () => {
  assert.equal(formatKcal(686), "686\u00a0kcal");
  assert.equal(formatGrams(42), "42\u00a0g");
});

test("the estimate marker survives, because measured ≠ estimated", () => {
  assert.equal(formatKcal(686, true), "\u2248686\u00a0kcal");
  assert.equal(formatGrams(42, true), "\u224842\u00a0g");
  // Explicitly false and undefined both mean "measured" — no marker.
  assert.equal(formatKcal(686, false), "686\u00a0kcal");
  assert.equal(formatGrams(42, undefined), "42\u00a0g");
});

test("fractional catalog values round rather than printing a decimal tail", () => {
  assert.equal(formatKcal(685.6), "686\u00a0kcal");
  assert.equal(formatGrams(41.4, true), "\u224841\u00a0g");
});

test("the dense-list line is one spelling for card and cart alike", () => {
  assert.equal(
    formatMacroLine({ calories: 686, protein: 42 }, true),
    "\u2248686\u00a0kcal · \u224842\u00a0g\u00a0P",
  );
  assert.equal(formatMacroLine({ calories: 450, protein: 30 }), "450\u00a0kcal · 30\u00a0g\u00a0P");
});

test("zero is a real value, not an absence", () => {
  assert.equal(formatGrams(0), "0\u00a0g");
  assert.equal(formatMacroLine({ calories: 0, protein: 0 }), "0\u00a0kcal · 0\u00a0g\u00a0P");
});

// ── provisional macros gate the DETAIL surfaces too ─────────────────────────
// formatMacroLine (the card) honoured `provisional`; formatKcal/formatGrams
// (the PDP and the dish drawer) did not, so a dish reading "Nutrition coming
// soon" on its card asserted "460 kcal" one tap later (2026-09-06 audit).

test("formatKcal withholds a provisional figure, like the card does", () => {
  assert.equal(formatKcal(460, false, true), MACROS_PENDING_LABEL);
  assert.equal(formatGrams(22, false, true), MACROS_PENDING_LABEL);
});

test("provisional outranks estimated, and neither flag changes a real figure", () => {
  assert.equal(formatKcal(460, true, true), MACROS_PENDING_LABEL);
  assert.equal(formatKcal(460), "460\u00a0kcal");
  assert.equal(formatGrams(22), "22\u00a0g");
});
