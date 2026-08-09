/**
 * Wire tests for the à-la-carte QuoteSnapshot client — the endpoint, method,
 * and body shape POST /orders/quote actually receives, plus the freshness
 * helper the checkout's quote-expired state keys off. Network-free via the
 * injectable fetchImpl.
 * Run: node --test --import tsx ./lib/quoteApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { fetchQuote, quoteIsFresh } from "./quoteApi";

function captureFetch(response: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}

const SNAPSHOT = {
  status: "active",
  version: 1,
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  items: [{ id: 1, name: "X", qty: 2, unitPaise: 5000, linePaise: 10000 }],
  subtotalPaise: 10000,
  deliveryFeePaise: 5000,
  packagingPaise: 0,
  discountPaise: 0,
  taxPaise: 1400,
  payableNowPaise: 16400,
  amountToFreeDeliveryPaise: 40000,
  etaMinutes: 25,
  serviceability: { pincode: "201301", serviceable: true },
};

test("fetchQuote POSTs items and pincode to /api/orders/quote", async () => {
  const { impl, calls } = captureFetch(SNAPSHOT);
  const q = await fetchQuote([{ dishId: 1, qty: 2 }], "201301", impl);

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.url.endsWith("/api/orders/quote"), calls[0]!.url);
  assert.equal(calls[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
    items: [{ dishId: 1, qty: 2 }],
    pincode: "201301",
  });
  assert.equal(q.payableNowPaise, 16400);
});

test("fetchQuote omits the pincode key entirely when none is given", async () => {
  const { impl, calls } = captureFetch(SNAPSHOT);
  await fetchQuote([{ dishId: 1, qty: 1 }], undefined, impl);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[0]!.init.body))), ["items"]);
});

test("quoteIsFresh: future expiry is fresh, past or malformed is not", () => {
  assert.equal(quoteIsFresh({ expiresAt: new Date(Date.now() + 60_000).toISOString() }), true);
  assert.equal(quoteIsFresh({ expiresAt: new Date(Date.now() - 1_000).toISOString() }), false);
  assert.equal(quoteIsFresh({ expiresAt: "not-a-date" }), false);
});
