// Pure-logic tests for the plan display map. DB-free; run via the api-server
// tsx loader (the documented runner for @workspace/tanmatra tests):
//   cd artifacts/api-server && node --test --import tsx \
//     ../tanmatra/src/components/plans/planDisplay.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG } from "@workspace/subscription-rules";
import { PLAN_DISPLAY, planDisplay } from "./planDisplay.js";

test("every plan in the catalog has a display entry", () => {
  for (const id of Object.keys(PLAN_CATALOG) as (keyof typeof PLAN_CATALOG)[]) {
    assert.ok(PLAN_DISPLAY[id], `missing display for ${id}`);
    assert.ok(PLAN_DISPLAY[id].name.length > 0);
    assert.ok(PLAN_DISPLAY[id].promise.length > 0);
  }
});

test("promises are ≤8 words (02f §2.2)", () => {
  for (const id of Object.keys(PLAN_DISPLAY) as (keyof typeof PLAN_DISPLAY)[]) {
    const words = PLAN_DISPLAY[id].promise.trim().split(/\s+/).length;
    assert.ok(words <= 8, `${id} promise has ${words} words: "${PLAN_DISPLAY[id].promise}"`);
  }
});

test("chips are capped at 3 per card (02f §2.2 / §5 density law)", () => {
  for (const id of Object.keys(PLAN_DISPLAY) as (keyof typeof PLAN_DISPLAY)[]) {
    assert.ok(PLAN_DISPLAY[id].chips.length <= 3, `${id} has >3 chips`);
  }
});

test("clinical flag mirrors requiresRdSignoff (RD beat on Steady + GLP-1)", () => {
  assert.equal(planDisplay("steady").clinical, true);
  assert.equal(planDisplay("glp1_companion").clinical, true);
  assert.equal(planDisplay("desk_fuel").clinical, false);
  assert.equal(planDisplay("protein_build").clinical, false);
});
