/**
 * SF-09 — the order-history client's wire contract (injected fetch, no network).
 * Locks method/path/credentials against orders.ts's GET /orders/mine and that a
 * 401 surfaces as a typed ApiError so the UI can offer sign-in.
 * Run: node --test --import tsx ./lib/ordersApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { getMyOrders } from "./ordersApi";

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

const ORDER = {
  serverOrderId: 1, externalOrderId: "alc-1", status: "delivered",
  totalPaise: 41800, addressLabel: "Home", createdAt: "2026-07-20T10:00:00Z",
};

test("getMyOrders: GET /api/orders/mine, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getMyOrders(fakeFetch(calls, () => ({ status: 200, body: { orders: [ORDER] } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/orders\/mine$/);
  assert.equal(c.credentials, "include");
  assert.equal(res.orders[0]?.externalOrderId, "alc-1");
});

test("401 surfaces as a typed ApiError (so the UI can offer sign-in)", async () => {
  const calls: Call[] = [];
  await assert.rejects(
    getMyOrders(fakeFetch(calls, () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
