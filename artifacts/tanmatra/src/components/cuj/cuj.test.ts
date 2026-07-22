// Pure-logic tests for the CUJ v2. DB-free; run via the api-server tsx loader:
//   cd artifacts/api-server && node --test --import tsx \
//     ../tanmatra/src/components/cuj/cuj.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUTER_ANSWERS,
  MENU_ESCAPE_ANSWER,
  routerDestination,
  defaultTrackForPlan,
  resolveBuilderDefaults,
  nextWeekday,
} from "./cuj.js";

test("router has exactly 5 answers, escape hatch last → menu", () => {
  assert.equal(ROUTER_ANSWERS.length, 5);
  assert.equal(ROUTER_ANSWERS[4].answer, MENU_ESCAPE_ANSWER);
  assert.deepEqual(ROUTER_ANSWERS[4].destination, { kind: "menu" });
  // the other four route to plans
  const plans = ROUTER_ANSWERS.slice(0, 4).map((a) =>
    a.destination.kind === "plan" ? a.destination.planId : null,
  );
  assert.deepEqual(
    plans.sort(),
    ["desk_fuel", "glp1_companion", "protein_build", "steady"],
  );
});

test("routerDestination maps known answers and falls through to menu", () => {
  assert.deepEqual(routerDestination("Keep my sugar steady"), {
    kind: "plan",
    planId: "steady",
  });
  assert.deepEqual(routerDestination("nonsense"), { kind: "menu" });
});

test("default track respects honest narrowing (never a track the plan can't fill)", () => {
  assert.equal(defaultTrackForPlan("desk_fuel"), "veg");
  assert.equal(defaultTrackForPlan("steady"), "nonveg"); // no veg track
  assert.equal(defaultTrackForPlan("glp1_companion"), "egg"); // egg is first served
  assert.equal(defaultTrackForPlan("protein_build"), "veg");
});

test("builder defaults are configure-by-exception (02e §5)", () => {
  const d = resolveBuilderDefaults("steady");
  assert.equal(d.duration, "monthly");
  assert.equal(d.mealsPerDay, 1);
  assert.equal(d.track, "nonveg");
  assert.equal(d.rdBump, false);
});

test("nextWeekday skips the weekend and never mutates the input", () => {
  // 2026-08-01 is a Saturday → Monday the 3rd
  const sat = new Date("2026-08-01T09:00:00.000Z");
  assert.equal(nextWeekday(sat).toISOString(), "2026-08-03T00:00:00.000Z");
  // 2026-08-02 Sunday → Monday the 3rd
  assert.equal(nextWeekday(new Date("2026-08-02T00:00:00.000Z")).toISOString(), "2026-08-03T00:00:00.000Z");
  // a weekday stays itself (normalized to midnight)
  assert.equal(nextWeekday(new Date("2026-08-05T15:00:00.000Z")).toISOString(), "2026-08-05T00:00:00.000Z");
  // input not mutated
  assert.equal(sat.toISOString(), "2026-08-01T09:00:00.000Z");
});
