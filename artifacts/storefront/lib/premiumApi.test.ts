import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutPremium, type PremiumCheckoutOrder } from "./premiumApi";

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

// The `payForPremium` sequencing test that lived here is gone with the wrapper
// it covered. The same create → open → verify order — plus the bounded verify
// retry and the authoritative settled() read the wrapper never had — is pinned
// on the shared path in lib/purchaseSteps.test.ts.
