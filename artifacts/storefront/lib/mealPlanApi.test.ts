import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import {
  generatePlan, swapSlot, getSwapSuggestions, acceptPlan, discardPlan, pickActivePlan,
  type MealPlan,
} from "./mealPlanApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Records the last request so we can assert method + url + body. */
function spy(body: unknown, status = 200) {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return jsonRes(body, status);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const plan = (o: Partial<MealPlan>): MealPlan => ({
  id: 7, userId: "u", weekStartDate: "2026-05-11", status: "draft", constraints: {
    dailyCalorieTarget: null, dailyProteinTargetGrams: null, weeklyBudgetPaise: null,
    maxRepetitionsPerDish: 2, allergens: [], dietaryStyle: null, spiceLevel: null, goal: null,
  }, days: [], totals: null, subscriptionId: null, model: null, notes: null,
  acceptedAt: null, createdAt: "", updatedAt: "", ...o,
});

test("generatePlan POSTs /meal-plans/generate and returns the plan", async () => {
  const { impl, calls } = spy({ plan: plan({}), usedFallback: false }, 201);
  const r = await generatePlan(undefined, impl);
  assert.match(calls[0]!.url, /\/api\/meal-plans\/generate$/);
  assert.equal(calls[0]!.method, "POST");
  assert.equal(r.usedFallback, false);
  assert.equal(r.plan.id, 7);
});

test("swapSlot PATCHes /meal-plans/:id/slot with the slot body", async () => {
  const { impl, calls } = spy({ plan: plan({}) });
  await swapSlot(7, 2, "lunch", 214, impl);
  assert.match(calls[0]!.url, /\/api\/meal-plans\/7\/slot$/);
  assert.equal(calls[0]!.method, "PATCH");
  assert.deepEqual(calls[0]!.body, { dayIndex: 2, slot: "lunch", dishId: 214 });
});

test("getSwapSuggestions POSTs swap-suggestions with planId in the body", async () => {
  const { impl, calls } = spy({ suggestions: [] });
  await getSwapSuggestions(7, 0, "breakfast", impl);
  assert.match(calls[0]!.url, /\/api\/meal-plans\/swap-suggestions$/);
  assert.deepEqual(calls[0]!.body, { planId: 7, dayIndex: 0, slot: "breakfast" });
});

test("acceptPlan and discardPlan POST to their :id routes", async () => {
  const a = spy({ plan: plan({ status: "scheduled" }), deliveryIds: [1, 2], subscriptionId: 9 });
  const res = await acceptPlan(7, a.impl);
  assert.match(a.calls[0]!.url, /\/api\/meal-plans\/7\/accept$/);
  assert.deepEqual(res.deliveryIds, [1, 2]);
  const d = spy({ plan: plan({ status: "discarded" }) });
  await discardPlan(7, d.impl);
  assert.match(d.calls[0]!.url, /\/api\/meal-plans\/7\/discard$/);
});

test("pickActivePlan prefers a draft, else the first, else null", () => {
  assert.equal(pickActivePlan([]), null);
  const scheduled = plan({ id: 1, status: "scheduled" });
  const draft = plan({ id: 2, status: "draft" });
  assert.equal(pickActivePlan([scheduled, draft])!.id, 2);
  assert.equal(pickActivePlan([scheduled])!.id, 1);
});

test("a 401 surfaces as ApiError(401) for the auth gate", async () => {
  const { impl } = spy({ error: "unauthorized" }, 401);
  await assert.rejects(() => getSwapSuggestions(7, 0, "lunch", impl), (e) => e instanceof ApiError && e.status === 401);
});
