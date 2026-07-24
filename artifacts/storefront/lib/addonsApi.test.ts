/**
 * SF-11 — the add-on attach client's wire contract, tested with an injected
 * fetch (no network). Locks method/path/credentials/body against the server
 * routes (subscriptions.ts §add-ons) and that auth/allow-list failures surface
 * as typed ApiErrors the UI can branch on.
 * Run: cd artifacts/api-server && node --test --import tsx ../storefront/lib/addonsApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getSubscriptionAddOns, attachAddOn, detachAddOn, type AttachedAddOn } from "./addonsApi";
import { ApiError } from "./apiClient";

interface Call {
  method: string;
  url: string;
  body?: string;
  credentials?: string;
}

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      body: init.body as string | undefined,
      credentials: init.credentials as string | undefined,
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

const ROW: AttachedAddOn = {
  id: 1, subscriptionId: 12, addonId: "evening_add", pricePaise: 59900, cadence: "weekly", active: true,
};

test("getSubscriptionAddOns: GET /api/subscriptions/:id/add-ons, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getSubscriptionAddOns(12, fakeFetch(calls, () => ({ status: 200, body: { addOns: [ROW] } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/subscriptions\/12\/add-ons$/);
  assert.equal(c.credentials, "include");
  assert.equal(c.body, undefined);
  assert.deepEqual(res.addOns, [ROW]);
});

test("attachAddOn: POST with {addOnId} only — never a price in the request", async () => {
  const calls: Call[] = [];
  const res = await attachAddOn(12, "evening_add", fakeFetch(calls, () => ({ status: 201, body: { addOn: ROW } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/subscriptions\/12\/add-ons$/);
  assert.deepEqual(JSON.parse(c.body ?? "{}"), { addOnId: "evening_add" });
  assert.equal(res.addOn.pricePaise, 59900); // the SERVER's snapshot comes back
});

test("attachAddOn: an idempotent re-tap (200 alreadyActive) parses as success", async () => {
  const calls: Call[] = [];
  const res = await attachAddOn(12, "evening_add", fakeFetch(calls, () => ({
    status: 200, body: { addOn: ROW, alreadyActive: true },
  })));
  assert.equal(res.alreadyActive, true);
});

test("attachAddOn: 422 addon_not_allowed surfaces as a typed ApiError", async () => {
  await assert.rejects(
    attachAddOn(12, "rd_bump", fakeFetch([], () => ({
      status: 422, body: { error: "add-on not available for this plan", code: "addon_not_allowed" },
    }))),
    (e: unknown) => e instanceof ApiError && e.status === 422 && e.code === "addon_not_allowed",
  );
});

test("detachAddOn: DELETE /api/subscriptions/:id/add-ons/:addOnId, no body", async () => {
  const calls: Call[] = [];
  const res = await detachAddOn(12, "evening_add", fakeFetch(calls, () => ({
    status: 200, body: { ok: true, detached: "evening_add" },
  })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "DELETE");
  assert.match(c.url, /\/api\/subscriptions\/12\/add-ons\/evening_add$/);
  assert.equal(c.body, undefined);
  assert.equal(res.detached, "evening_add");
});
