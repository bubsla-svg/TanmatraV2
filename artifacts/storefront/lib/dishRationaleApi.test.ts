/**
 * Dish-rationale client's wire contract (injected fetch, no network).
 * Run: node --test --import tsx ./lib/dishRationaleApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { getDishRationales } from "./dishRationaleApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      credentials: init.credentials as string | undefined,
      body: init.body,
    });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

test("getDishRationales: POST /api/dish-rationales sends {dishIds}, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getDishRationales(
    [7, 9],
    fakeFetch(calls, () => ({
      status: 200,
      body: { rationales: [{ dishId: 7, rationale: "22g protein per serving.", expanded: "…", source: "fallback" }] },
    })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/dish-rationales$/);
  assert.equal(c.credentials, "include");
  assert.deepEqual(JSON.parse(String(c.body)), { dishIds: [7, 9] });
  assert.equal(res.rationales[0]?.dishId, 7);
});

test("getDishRationales: 401 surfaces as a typed ApiError (signed-out → hide the section)", async () => {
  await assert.rejects(
    getDishRationales([7], fakeFetch([], () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
