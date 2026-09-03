import assert from "node:assert/strict";
import { test } from "node:test";
import { goalFilterForPlan, menuHrefForPlan } from "./planGoalFilter";
import { parseMenuUrlState } from "./menuUrlState";

test("every router plan maps to a goal the menu can actually filter by", () => {
  for (const [plan, goal] of [
    ["desk_fuel", "fat_loss"],
    ["steady", "glucose_steady"],
    ["protein_build", "high_protein"],
    ["glp1_companion", "glucose_steady"],
  ] as const) {
    assert.equal(goalFilterForPlan(plan), goal);
    const href = menuHrefForPlan(plan);
    assert.ok(href);
    const parsed = parseMenuUrlState(new URL(href, "https://x").searchParams);
    assert.deepEqual(parsed.filters.goal, [goal], `${href} must round-trip through the menu's own parser`);
  }
});

test("a plan with no honest goal gets no link rather than a made-up one", () => {
  assert.equal(goalFilterForPlan("teams"), null);
  assert.equal(menuHrefForPlan("trial_3day"), null);
});
