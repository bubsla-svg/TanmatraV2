import { test } from "node:test";
import assert from "node:assert/strict";
import { regenerateDay, getSettings, updateSettings } from "./mealPlanApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("regenerateDay POSTs /meal-plans/:id/regenerate-day with the day index", async () => {
  let seen: { url: string; method?: string; body: any } | null = null;
  const impl = (async (u: string, init?: RequestInit) => { seen = { url: u, method: init?.method, body: JSON.parse(String(init?.body)) }; return jsonRes({ plan: {} }); }) as unknown as typeof fetch;
  await regenerateDay(7, 3, impl);
  assert.match(seen!.url, /\/api\/meal-plans\/7\/regenerate-day$/);
  assert.equal(seen!.method, "POST");
  assert.deepEqual(seen!.body, { dayIndex: 3 });
});

test("getSettings GETs and updateSettings PUTs /meal-plan-settings", async () => {
  const calls: { url: string; method?: string; body?: any }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return jsonRes({ settings: { autoReplanEnabled: false, weeklyBudgetPaise: null, maxRepetitionsPerDish: 2 } }); }) as unknown as typeof fetch;
  await getSettings(impl);
  await updateSettings({ weeklyBudgetPaise: 700000, maxRepetitionsPerDish: 3, autoReplanEnabled: true }, impl);
  assert.match(calls[0]!.url, /\/api\/meal-plan-settings$/);
  assert.equal(calls[1]!.method, "PUT");
  assert.equal(calls[1]!.body.weeklyBudgetPaise, 700000);
});
