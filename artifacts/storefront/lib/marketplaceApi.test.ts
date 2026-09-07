import { test } from "node:test";
import assert from "node:assert/strict";
import type { RazorpayAdapter } from "./moneyPath";
import { listItems, checkout, finishMarketplacePayment, fetchMarketplaceItemsServer } from "./marketplaceApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// fetchMarketplaceItemsServer calls the platform `fetch` directly (it's a
// server-only helper, not one of the fetchImpl-injectable clients below), so
// these two tests stub globalThis.fetch and restore it afterwards.
test("fetchMarketplaceItemsServer returns the items array on success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({ items: [{ id: 1 }] })) as unknown as typeof fetch;
  try {
    const items = await fetchMarketplaceItemsServer();
    assert.deepEqual(items, [{ id: 1 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMarketplaceItemsServer falls back to an empty array on failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;
  try {
    const items = await fetchMarketplaceItemsServer();
    assert.deepEqual(items, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchMarketplaceItemsServer falls back to an empty array on a non-OK response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonRes({}, 500)) as unknown as typeof fetch;
  try {
    const items = await fetchMarketplaceItemsServer();
    assert.deepEqual(items, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listItems appends ?category (and omits it for 'all')", async () => {
  const urls: string[] = [];
  const impl = (async (u: string) => { urls.push(u); return jsonRes({ items: [] }); }) as unknown as typeof fetch;
  await listItems("oils", impl);
  await listItems("all", impl);
  assert.match(urls[0]!, /\/api\/marketplace\/items\?category=oils$/);
  assert.match(urls[1]!, /\/api\/marketplace\/items$/);
});

test("checkout sends the Idempotency-Key header and no key in the body", async () => {
  let seen: { url: string; headers: any; body: any } | null = null;
  const impl = (async (u: string, init?: RequestInit) => {
    seen = { url: u, headers: init?.headers, body: JSON.parse(String(init?.body)) };
    return jsonRes({ order: { id: 1, externalOrderId: "mkt-1", status: "placed", totalPaise: 34000 } });
  }) as unknown as typeof fetch;
  await checkout({ idempotencyKey: "idem-1", items: [{ itemId: 5, qty: 2 }], deliveryMode: "ship" }, impl);
  assert.match(seen!.url, /\/api\/marketplace\/checkout$/);
  assert.equal((seen!.headers as Record<string, string>)["Idempotency-Key"], "idem-1");
  assert.equal(seen!.body.idempotencyKey, undefined);
  assert.deepEqual(seen!.body.items, [{ itemId: 5, qty: 2 }]);
});

// The one-call `payForMarketplace` wrapper these two tests covered is gone: it
// minted a fresh idempotency key per call, so a retried create was a second
// order, stock decrement and charge. The pantry now composes `checkout` +
// `finishMarketplacePayment` on the shared /checkout page, holding ONE key for
// the whole attempt (lib/purchaseSteps.ts) — so the sequencing is pinned here
// on the two calls that remain, and the key reuse in lib/purchaseSteps.test.ts.

test("the pantry money path runs checkout → razorpay order → open → verify, in order", async () => {
  const seq: string[] = [];
  const impl = (async (u: string) => {
    const url = String(u);
    if (url.endsWith("/marketplace/checkout")) { seq.push("checkout"); return jsonRes({ order: { id: 1, externalOrderId: "mkt-9", status: "placed", totalPaise: 34000 } }); }
    if (url.endsWith("/payments/razorpay/order")) { seq.push("order"); return jsonRes({ razorpayOrderId: "order_9", amount: 34000, currency: "INR", keyId: "rzp" }); }
    if (url.endsWith("/payments/razorpay/verify")) { seq.push("verify"); return jsonRes({ ok: true, orderId: "mkt-9", status: "preparing" }); }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  const razorpay: RazorpayAdapter = {
    open: async (o) => { seq.push("open"); assert.equal(o.razorpayOrderId, "order_9"); return { razorpayPaymentId: "pay", razorpayOrderId: o.razorpayOrderId, razorpaySignature: "sig" }; },
  };
  const { order } = await checkout({ idempotencyKey: "idem-9", items: [{ itemId: 5, qty: 1 }] }, impl);
  const paid = await finishMarketplacePayment(order, razorpay, {}, impl);
  assert.deepEqual(seq, ["checkout", "order", "open", "verify"]);
  assert.equal(paid.externalOrderId, "mkt-9");
});

test("bundle mode passes deliveryMode + bundleWithOrderId to checkout", async () => {
  let body: Record<string, unknown> | null = null;
  const impl = (async (_u: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonRes({ order: { id: 1, externalOrderId: "mkt-b", status: "placed", totalPaise: 34000 } });
  }) as unknown as typeof fetch;
  await checkout(
    { idempotencyKey: "idem-b", items: [{ itemId: 5, qty: 1 }], deliveryMode: "bundle_with_meal", bundleWithOrderId: 77 },
    impl,
  );
  assert.equal(body!["deliveryMode"], "bundle_with_meal");
  assert.equal(body!["bundleWithOrderId"], 77);
});

// ── Robustness parity with the meal money paths (revenue-path audit fixes) ───

test("a 5xx verify is retried in place — checkout and the modal never re-run", async () => {
  // The regression this pins: the pantry path used a single bare verifyPayment,
  // so a transient 5xx after CAPTURE surfaced as a failure, the Buy button
  // re-enabled, and a re-tap minted a fresh idempotency key — a second order,
  // stock decrement, and charge.
  const seq: string[] = [];
  let verifyCalls = 0;
  const impl = (async (u: string) => {
    const url = String(u);
    if (url.endsWith("/marketplace/checkout")) { seq.push("checkout"); return jsonRes({ order: { id: 1, externalOrderId: "mkt-r", status: "placed", totalPaise: 34000 } }); }
    if (url.endsWith("/payments/razorpay/order")) { seq.push("order"); return jsonRes({ razorpayOrderId: "order_r", amount: 34000, currency: "INR", keyId: "k" }); }
    if (url.endsWith("/payments/razorpay/verify")) {
      seq.push("verify");
      verifyCalls += 1;
      if (verifyCalls === 1) return jsonRes({ error: "gateway hiccup" }, 503);
      return jsonRes({ ok: true, orderId: "mkt-r", status: "preparing" });
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  const razorpay: RazorpayAdapter = {
    open: async (o) => { seq.push("open"); return { razorpayPaymentId: "p", razorpayOrderId: o.razorpayOrderId, razorpaySignature: "s" }; },
  };
  const { order: created } = await checkout({ idempotencyKey: "idem-r", items: [{ itemId: 5, qty: 1 }] }, impl);
  const order = await finishMarketplacePayment(created, razorpay, {}, impl);
  assert.equal(order.externalOrderId, "mkt-r");
  assert.deepEqual(seq, ["checkout", "order", "open", "verify", "verify"]);
});

test("finishMarketplacePayment resumes an existing order — no second checkout exists to call", async () => {
  const seq: string[] = [];
  const impl = (async (u: string) => {
    const url = String(u);
    if (url.endsWith("/marketplace/checkout")) throw new Error("resume must NOT re-run checkout");
    if (url.endsWith("/payments/razorpay/order")) { seq.push("order"); return jsonRes({ razorpayOrderId: "order_f", amount: 34000, currency: "INR", keyId: "k" }); }
    if (url.endsWith("/payments/razorpay/verify")) { seq.push("verify"); return jsonRes({ ok: true, orderId: "mkt-f", status: "preparing" }); }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  const razorpay: RazorpayAdapter = {
    open: async (o) => { seq.push("open"); return { razorpayPaymentId: "p", razorpayOrderId: o.razorpayOrderId, razorpaySignature: "s" }; },
  };
  const order = await finishMarketplacePayment(
    { id: 1, externalOrderId: "mkt-f", status: "placed", totalPaise: 34000 },
    razorpay,
    {},
    impl,
  );
  assert.equal(order.externalOrderId, "mkt-f");
  assert.deepEqual(seq, ["order", "open", "verify"]);
});

test("onCaptured carries the exact facts a verify-only retry needs", async () => {
  // These are what the runner keeps so an exhausted verify can be re-asked
  // WITHOUT re-opening the modal over an already-captured payment.
  let captured: unknown = null;
  const impl = (async (u: string) => {
    const url = String(u);
    if (url.endsWith("/payments/razorpay/order")) return jsonRes({ razorpayOrderId: "order_h", amount: 34000, currency: "INR", keyId: "k" });
    if (url.endsWith("/payments/razorpay/verify")) return jsonRes({ ok: true, orderId: "mkt-h", status: "preparing" });
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  const razorpay: RazorpayAdapter = {
    open: async (o) => ({ razorpayPaymentId: "pay_h", razorpayOrderId: o.razorpayOrderId, razorpaySignature: "sig_h" }),
  };
  await finishMarketplacePayment(
    { id: 1, externalOrderId: "mkt-h", status: "placed", totalPaise: 34000 },
    razorpay,
    { onCaptured: (f) => { captured = f; } },
    impl,
  );
  assert.deepEqual(captured, {
    orderId: "mkt-h",
    razorpayPaymentId: "pay_h",
    razorpayOrderId: "order_h",
    razorpaySignature: "sig_h",
  });
});
