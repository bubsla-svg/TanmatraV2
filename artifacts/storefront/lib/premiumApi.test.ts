import { test } from "node:test";
import assert from "node:assert/strict";
import type { RazorpayAdapter } from "./moneyPath";
import { payForPremium, checkoutPremium, type PremiumCheckoutOrder } from "./premiumApi";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const ORDER: PremiumCheckoutOrder = { razorpayOrderId: "order_1", amount: 99900, currency: "INR", keyId: "rzp_test" };

test("checkoutPremium POSTs /premium/checkout and returns the server order", async () => {
  let url = "";
  const impl = (async (u: string, init?: RequestInit) => { url = u; assert.equal(init?.method, "POST"); return jsonRes(ORDER); }) as unknown as typeof fetch;
  const o = await checkoutPremium(impl);
  assert.match(url, /\/api\/premium\/checkout$/);
  assert.equal(o.amount, 99900);
});

test("payForPremium runs checkout → adapter.open(order) → verify, in order", async () => {
  const seq: string[] = [];
  const impl = (async (u: string) => {
    if (String(u).endsWith("/premium/checkout")) { seq.push("checkout"); return jsonRes(ORDER); }
    if (String(u).endsWith("/premium/verify")) { seq.push("verify"); return jsonRes({ membership: { status: "active" }, isPremium: true }); }
    throw new Error(`unexpected ${u}`);
  }) as unknown as typeof fetch;

  const razorpay: RazorpayAdapter = {
    open: async (order) => {
      seq.push("open");
      assert.equal(order.razorpayOrderId, "order_1"); // the server's order, not a client price
      return { razorpayPaymentId: "pay_1", razorpayOrderId: order.razorpayOrderId, razorpaySignature: "sig" };
    },
  };

  const m = await payForPremium(razorpay, impl);
  assert.deepEqual(seq, ["checkout", "open", "verify"]);
  assert.equal(m.status, "active");
});
