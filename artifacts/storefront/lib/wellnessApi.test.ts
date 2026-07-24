import { test } from "node:test";
import assert from "node:assert/strict";
import { getToday, logMeal, logWater, deleteLog, pctOf } from "./wellnessApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("getToday GETs /wellness/today", async () => {
  let url = "";
  const impl = (async (u: string) => { url = u; return jsonRes({}); }) as unknown as typeof fetch;
  await getToday(impl);
  assert.match(url, /\/api\/wellness\/today$/);
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

test("pctOf clamps to 0–100 and guards a zero target", () => {
  assert.equal(pctOf(50, 100), 50);
  assert.equal(pctOf(150, 100), 100);
  assert.equal(pctOf(10, 0), 0);
});
