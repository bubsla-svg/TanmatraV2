/**
 * Flipbook F-1, root cause: in the merged catalog a dish's macro NUMBERS came
 * from the DB row while the flag QUALIFYING them came from the static
 * catalog. This pins the rule that they travel together.
 *
 * DB-free on purpose, matching menuResolver.allergenReview.test.ts: the rule
 * is pure, and the fixtures that make it matter come from the real
 * @workspace/menu-catalog build.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES } from "@workspace/menu-catalog";
import {
  resolveMacrosEstimated,
  resolveMacrosProvisional,
} from "./macroProvenance";

// ── the rule ────────────────────────────────────────────────────────────────

test("a DB row that supplies macros supplies the claim with them", () => {
  // Static said "curated, show as fact"; the row overrides the numbers, so
  // the row's own flag decides — not the static one describing other numbers.
  assert.equal(
    resolveMacrosEstimated({
      rowHasMacros: true,
      rowMacrosAreEstimate: true,
      staticMacrosEstimated: false,
    }),
    true,
    "a DB estimate must not inherit the static catalog's 'this is fact'",
  );
  // And the converse: an explicitly curated row may drop the marker.
  assert.equal(
    resolveMacrosEstimated({
      rowHasMacros: true,
      rowMacrosAreEstimate: false,
      staticMacrosEstimated: true,
    }),
    false,
  );
});

test("no DB macros means the static flag still governs the static numbers", () => {
  assert.equal(
    resolveMacrosEstimated({
      rowHasMacros: false,
      rowMacrosAreEstimate: false, // irrelevant — the row has no numbers
      staticMacrosEstimated: true,
    }),
    true,
  );
  assert.equal(
    resolveMacrosEstimated({
      rowHasMacros: false,
      rowMacrosAreEstimate: true,
      staticMacrosEstimated: false,
    }),
    false,
  );
});

test("a CMS/POS-only dish (no static counterpart) reads its own column", () => {
  // macros_are_estimate is NOT NULL default true, so the fail-soft direction
  // is "estimated" — an un-curated import renders with ≈ rather than as fact.
  assert.equal(
    resolveMacrosEstimated({
      rowHasMacros: true,
      rowMacrosAreEstimate: true,
      staticMacrosEstimated: undefined,
    }),
    true,
  );
});

test("undefined static flag is false, never undefined", () => {
  // The field is optional on DishData; leaking `undefined` into the payload
  // would read as falsy downstream — same verdict, but by accident.
  assert.equal(
    resolveMacrosEstimated({
      rowHasMacros: false,
      rowMacrosAreEstimate: false,
      staticMacrosEstimated: undefined,
    }),
    false,
  );
});

test("macrosProvisional is sticky — a DB row can never loosen the gate", () => {
  assert.equal(resolveMacrosProvisional(true), true);
  assert.equal(resolveMacrosProvisional(false), false);
  assert.equal(resolveMacrosProvisional(undefined), false);
});

// ── fixture guards: why the rule matters on the real catalog ────────────────

test("the static catalog really does carry dishes that render as FACT", () => {
  // These are the dangerous ones: macrosEstimated false AND not provisional,
  // so a DB placeholder on one of them would print unqualified. If curation
  // ever moves every dish onto the estimate path this guard should move too.
  const asFact = DISHES.filter((d) => !d.macrosEstimated && !d.macrosProvisional);
  assert.ok(
    asFact.length > 0,
    "expected some curated-distinct dishes — they are the reason the flag must not be inherited",
  );
});

test("diet-coke-can is the live proof: static is 0 kcal, so a nonzero card came from the DB", () => {
  const coke = DISHES.find((d) => d.slug === "diet-coke-can");
  assert.ok(coke, "diet-coke-can disappeared from the static catalog");
  assert.equal(coke.macros.calories, 0, "a zero-calorie soda must be 0 kcal statically");
  assert.equal(coke.macros.protein, 0);
  // The flipbook captured this dish rendering "≈140 kcal · ≈3 g P". With the
  // static value at 0/0 those numbers can only have come from the DB row,
  // while the ≈ marker came from this `true` — the exact split being fixed.
  assert.equal(coke.macrosEstimated, true);
});
