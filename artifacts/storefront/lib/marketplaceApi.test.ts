import { test } from "node:test";
import assert from "node:assert/strict";
import type { RazorpayAdapter } from "./moneyPath";
import { listItems, checkout, payForMarketplace } from "./marketplaceApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

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

test("payForMarketplace: checkout → razorpay order → open → verify, in order", async () => {
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
  const order = await payForMarketplace({ itemId: 5, qty: 1 }, razorpay, {}, impl);
  assert.deepEqual(seq, ["checkout", "order", "open", "verify"]);
  assert.equal(order.externalOrderId, "mkt-9");
});

test("payForMarketplace bundle mode passes deliveryMode + bundleWithOrderId to checkout", async () => {
  let body: any = null;
  const impl = (async (u: string, init?: RequestInit) => {
    const url = String(u);
    if (url.endsWith("/marketplace/checkout")) { body = JSON.parse(String(init?.body)); return jsonRes({ order: { id: 1, externalOrderId: "mkt-b", status: "placed", totalPaise: 34000 } }); }
    if (url.endsWith("/payments/razorpay/order")) return jsonRes({ razorpayOrderId: "o", amount: 34000, currency: "INR", keyId: "k" });
    return jsonRes({ ok: true, orderId: "mkt-b", status: "preparing" });
  }) as unknown as typeof fetch;
  const razorpay: RazorpayAdapter = { open: async (o) => ({ razorpayPaymentId: "p", razorpayOrderId: o.razorpayOrderId, razorpaySignature: "s" }) };
  await payForMarketplace({ itemId: 5, qty: 1 }, razorpay, { deliveryMode: "bundle_with_meal", bundleWithOrderId: 77 }, impl);
  assert.equal(body.deliveryMode, "bundle_with_meal");
  assert.equal(body.bundleWithOrderId, 77);
});
