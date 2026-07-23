/**
 * SF-08 — the subscription-management client's wire contract (injected fetch,
 * no network). Locks method/path/credentials against subscriptions.ts and that
 * a 401 surfaces as a typed ApiError so the UI can offer sign-in.
 * Run: node --test --import tsx ./lib/subscriptionsApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import {
  getSubscriptions,
  getSubscription,
  getMealCredits,
  skipDelivery,
  unskipDelivery,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  reactivateSubscriptionBilling,
} from "./subscriptionsApi";

interface Call { method: string; url: string; credentials?: string }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({ method: String(init.method), url: String(url), credentials: init.credentials as string | undefined });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

const SUB = { id: 7, status: "active" };

test("getSubscriptions: GET /api/subscriptions, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getSubscriptions(fakeFetch(calls, () => ({ status: 200, body: { subscriptions: [SUB] } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/subscriptions$/);
  assert.equal(c.credentials, "include");
  assert.equal(res.subscriptions[0]?.id, 7);
});

test("lifecycle transitions POST /api/subscriptions/:id/<action>", async () => {
  const cases: Array<[(id: number, f?: typeof fetch) => Promise<unknown>, string]> = [
    [pauseSubscription, "pause"],
    [resumeSubscription, "resume"],
    [cancelSubscription, "cancel"],
    [reactivateSubscriptionBilling, "reactivate-billing"],
  ];
  for (const [fn, action] of cases) {
    const calls: Call[] = [];
    await fn(7, fakeFetch(calls, () => ({ status: 200, body: { subscription: { ...SUB, status: action } } })));
    const [c] = calls;
    assert.ok(c);
    assert.equal(c.method, "POST");
    assert.match(c.url, new RegExp(`/api/subscriptions/7/${action}$`));
    assert.equal(c.credentials, "include");
  }
});

test("409 illegal transition surfaces as a typed ApiError", async () => {
  const calls: Call[] = [];
  await assert.rejects(
    pauseSubscription(7, fakeFetch(calls, () => ({ status: 409, body: { error: "subscription is not active" } }))),
    (e) => e instanceof ApiError && e.status === 409 && /not active/.test((e as Error).message),
  );
});

test("401 surfaces as a typed ApiError (so the UI can offer sign-in)", async () => {
  const calls: Call[] = [];
  await assert.rejects(
    getSubscriptions(fakeFetch(calls, () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("getSubscription: GET /api/subscriptions/:id → detail incl. deliveries + mandate", async () => {
  const calls: Call[] = [];
  const res = await getSubscription(7, fakeFetch(calls, () => ({
    status: 200,
    body: { subscription: SUB, members: [], deliveries: [{ id: 31, subscriptionId: 7, scheduledFor: "2026-07-27", status: "upcoming" }], mandate: null },
  })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/subscriptions\/7$/);
  assert.equal(c.credentials, "include");
  assert.equal(res.deliveries[0]?.status, "upcoming");
  assert.equal(res.mandate, null);
});

test("skip/unskip POST /api/subscription-deliveries/:id/<action>", async () => {
  for (const [fn, action] of [[skipDelivery, "skip"], [unskipDelivery, "unskip"]] as const) {
    const calls: Call[] = [];
    await fn(31, fakeFetch(calls, () => ({ status: 200, body: { delivery: { id: 31, status: action === "skip" ? "skipped" : "upcoming" } } })));
    const [c] = calls;
    assert.ok(c);
    assert.equal(c.method, "POST");
    assert.match(c.url, new RegExp(`/api/subscription-deliveries/31/${action}$`));
    assert.equal(c.credentials, "include");
  }
});

test("skip past the cutoff surfaces the server's 409 past_cutoff verbatim", async () => {
  await assert.rejects(
    skipDelivery(31, fakeFetch([], () => ({
      status: 409,
      body: { error: "This delivery is too close to its delivery time to skip.", code: "past_cutoff" },
    }))),
    (e) => e instanceof ApiError && e.status === 409 && e.code === "past_cutoff" && /too close/.test((e as Error).message),
  );
});

test("getMealCredits: GET /api/meal-credits → the server's balance", async () => {
  const calls: Call[] = [];
  const res = await getMealCredits(fakeFetch(calls, () => ({ status: 200, body: { credits: [], balance: 3 } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/meal-credits$/);
  assert.equal(res.balance, 3);
});
