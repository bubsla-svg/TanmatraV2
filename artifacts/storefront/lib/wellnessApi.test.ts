import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getToday,
  getWeek,
  logMeal,
  logWater,
  deleteLog,
  pctOf,
  generatePrecisionPlan,
  getPrecisionPlanDraft,
  claimPrecisionPlanDraft,
  type PrecisionPlanResult,
  type PrecisionPlannerInput,
} from "./wellnessApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("getToday GETs /wellness/today", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({}); }) as unknown as typeof fetch;
  await getToday(impl);
  assert.match(url, /\/api\/wellness\/today$/);
});

test("getWeek GETs /wellness/week", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({ from: "", to: "", days: [], targets: null }); }) as unknown as typeof fetch;
  await getWeek(impl);
  assert.match(url, /\/api\/wellness\/week$/);
});

test("logMeal POSTs the manual log; logWater POSTs { ml }", async () => {
  const calls: { url: string; method?: string; body: any }[] = [];
  const impl = (async (u: string, init?: RequestInit) => { calls.push({ url: u, method: init?.method, body: JSON.parse(String(init?.body)) }); return jsonRes({ log: {} }); }) as unknown as typeof fetch;
  await logMeal({ label: "Greek yoghurt", calories: 180, proteinGrams: 15 }, impl);
  await logWater(250, impl);
  assert.match(calls[0]!.url, /\/api\/wellness\/log$/);
  assert.equal(calls[0]!.method, "POST");
  assert.equal(calls[0]!.body.label, "Greek yoghurt");
  assert.match(calls[1]!.url, /\/api\/wellness\/water$/);
  assert.deepEqual(calls[1]!.body, { ml: 250 });
});

test("deleteLog DELETEs /wellness/log/:id", async () => {
  let url = "", method = "";
  const impl = (async (u: string, init?: RequestInit) => { url = u; method = init?.method ?? ""; return jsonRes({ ok: true }); }) as unknown as typeof fetch;
  await deleteLog(42, impl);
  assert.match(url, /\/api\/wellness\/log\/42$/);
  assert.equal(method, "DELETE");
});

test("pctOf clamps to 0-100 and handles a zero target", () => {
  assert.equal(pctOf(50, 100), 50);
  assert.equal(pctOf(150, 100), 100);
  assert.equal(pctOf(5, 0), 0);
});

const INPUT: PrecisionPlannerInput = {
  age: 30,
  gender: "male",
  heightCm: 170,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "fat_loss",
  dietPreference: "any",
};

const PLAN: PrecisionPlanResult = {
  bmr: 1600,
  tdee: 2480,
  targetCalories: 1984,
  targetProteinG: 124,
  targetCarbsG: 223,
  targetFatG: 66,
  dailyThalis: [],
  totalPlanPricePaise: 210000,
};

test("generatePrecisionPlan: POSTs the input and returns the plan plus its persisted draftId", async () => {
  let url = "";
  let method = "";
  let body: unknown = null;
  const impl = (async (u: string, init?: RequestInit) => {
    url = u;
    method = init?.method ?? "";
    body = init?.body ? JSON.parse(String(init.body)) : null;
    return jsonRes({ plan: PLAN, draftId: "abc123" });
  }) as unknown as typeof fetch;

  const res = await generatePrecisionPlan(INPUT, impl);

  assert.match(url, /\/api\/wellness\/precision-planner\/generate$/);
  assert.equal(method, "POST");
  assert.deepEqual(body, INPUT);
  assert.equal(res.draftId, "abc123");
  assert.equal(res.plan.totalPlanPricePaise, 210000);
});

test("getPrecisionPlanDraft: GETs the draft by id, URL-encoded", async () => {
  let url = "";
  const impl = (async (u: string) => {
    url = u;
    return jsonRes({ draft: { id: "has space/slash", input: INPUT, result: PLAN } });
  }) as unknown as typeof fetch;

  const res = await getPrecisionPlanDraft("has space/slash", impl);

  assert.match(url, /\/api\/wellness\/precision-planner\/drafts\/has%20space%2Fslash$/);
  assert.equal(res.draft.id, "has space/slash");
  assert.equal(res.draft.result.bmr, 1600);
});

test("claimPrecisionPlanDraft: POSTs to the claim sub-route", async () => {
  let url = "";
  let method = "";
  const impl = (async (u: string, init?: RequestInit) => {
    url = u;
    method = init?.method ?? "";
    return jsonRes({ draft: { id: "abc123", input: INPUT, result: PLAN } });
  }) as unknown as typeof fetch;

  const res = await claimPrecisionPlanDraft("abc123", impl);

  assert.match(url, /\/api\/wellness\/precision-planner\/drafts\/abc123\/claim$/);
  assert.equal(method, "POST");
  assert.equal(res.draft.id, "abc123");
});
