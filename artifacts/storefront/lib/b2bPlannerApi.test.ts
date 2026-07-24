import { test } from "node:test";
import assert from "node:assert/strict";
import { getDietProfile, saveDietProfile, getCurrentPlan, generatePlan, schedulePlan } from "./b2bPlannerApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("getDietProfile GETs /companies/:slug/diet-profile", async () => {
  let url = ""; let method = "";
  const impl = (async (u: string, init?: RequestInit) => { url = u; method = init?.method ?? "GET"; return jsonRes({ profile: null }); }) as unknown as typeof fetch;
  await getDietProfile("acme", impl);
  assert.match(url, /\/api\/companies\/acme\/diet-profile$/);
  assert.equal(method, "GET");
});

test("saveDietProfile PUTs the survey body verbatim", async () => {
  const calls: { url: string; method?: string; body: unknown }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return jsonRes({ profile: {} }); }) as unknown as typeof fetch;
  await saveDietProfile("acme", { headcount: 20, vegCount: 8, allergens: ["peanut"], calorieFloor: 400, calorieCeiling: null }, impl);
  assert.match(calls[0]!.url, /\/api\/companies\/acme\/diet-profile$/);
  assert.equal(calls[0]!.method, "PUT");
  assert.deepEqual(calls[0]!.body, { headcount: 20, vegCount: 8, allergens: ["peanut"], calorieFloor: 400, calorieCeiling: null });
});

test("slug is URL-encoded into the path", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({ profile: null }); }) as unknown as typeof fetch;
  await getDietProfile("acme corp", impl);
  assert.match(url, /\/api\/companies\/acme%20corp\/diet-profile$/);
});

test("getCurrentPlan / generatePlan hit the lunch-plan sub-routes", async () => {
  const calls: { url: string; method?: string }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, method: init?.method }); return jsonRes({ proposal: null }); }) as unknown as typeof fetch;
  await getCurrentPlan("acme", impl);
  await generatePlan("acme", impl);
  assert.match(calls[0]!.url, /\/api\/companies\/acme\/lunch-plan\/current$/);
  assert.equal(calls[0]!.method ?? "GET", "GET");
  assert.match(calls[1]!.url, /\/api\/companies\/acme\/lunch-plan\/generate$/);
  assert.equal(calls[1]!.method, "POST");
});

test("schedulePlan POSTs /lunch-plans/:id/schedule with the window body", async () => {
  const calls: { url: string; method?: string; body: unknown }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return jsonRes({ proposal: {}, scheduledOfficeOrderIds: [] }); }) as unknown as typeof fetch;
  await schedulePlan(42, { scheduledHour: 13, perEmployeeBudgetPaise: 40000 }, impl);
  assert.match(calls[0]!.url, /\/api\/lunch-plans\/42\/schedule$/);
  assert.equal(calls[0]!.method, "POST");
  assert.deepEqual(calls[0]!.body, { scheduledHour: 13, perEmployeeBudgetPaise: 40000 });
});
