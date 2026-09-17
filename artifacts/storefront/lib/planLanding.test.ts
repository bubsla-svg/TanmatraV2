// Run: cd artifacts/storefront && node --test --import tsx ./lib/planLanding.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG } from "@workspace/subscription-rules";
import { planLandingHref } from "./planLanding";
import { menuHrefForPlan } from "./planGoalFilter";

test("the trial lands on /trial, where the trio is sold as cart lines", () => {
  assert.equal(planLandingHref("trial_3day"), "/trial");
});

test("every catalog plan lands on a menu surface or /trial — never on a plan route", () => {
  for (const id of Object.keys(PLAN_CATALOG)) {
    const href = planLandingHref(id);
    assert.match(href, /^\/(menu|trial)(\?|$)/, `${id} → ${href}`);
    assert.doesNotMatch(href, /\/plan\/|plan=/);
  }
});

test("a goal-mapped plan lands on the menu already filtered to its goal", () => {
  const mapped = Object.keys(PLAN_CATALOG).find((id) => menuHrefForPlan(id));
  assert.ok(mapped, "at least one plan maps to a menu goal filter");
  assert.equal(planLandingHref(mapped!), menuHrefForPlan(mapped!));
});

test("acquisition context survives the redirect; plan/waitlist params do not; the plan's own goal wins", () => {
  const mapped = Object.keys(PLAN_CATALOG).find((id) => menuHrefForPlan(id))!;
  const planGoal = new URL(menuHrefForPlan(mapped)!, "http://x").searchParams.get("goal");
  const href = planLandingHref(mapped, {
    acquisitionContextId: "ctx1",
    goal: "something_else",
    condition: "pcos",
    plan: mapped,
    waitlist: "1",
    empty: "",
    missing: undefined,
  });
  const url = new URL(href, "http://x");
  assert.equal(url.searchParams.get("acquisitionContextId"), "ctx1");
  assert.equal(url.searchParams.get("goal"), planGoal, "the plan's goal filter is the more specific answer");
  assert.equal(url.searchParams.getAll("goal").length, 1, "no duplicated goal param");
  assert.equal(url.searchParams.get("condition"), "pcos");
  assert.equal(url.searchParams.has("plan"), false);
  assert.equal(url.searchParams.has("waitlist"), false);
  assert.equal(url.searchParams.has("empty"), false);
});
