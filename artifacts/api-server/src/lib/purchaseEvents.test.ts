// Run: cd artifacts/api-server && DATABASE_URL=postgres://x node --test --import tsx ./src/lib/purchaseEvents.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentFailedProps, purchaseProps } from "./purchaseEvents";

const order = {
  id: 9,
  externalOrderId: "TAN-9",
  userId: null,
  chargePaise: null,
  totalPaise: 37300,
  acquisitionSrc: "box",
  funnelSessionId: "fs_1",
};

test("purchase carries order_id, the authoritative amount, method, capture path and src", () => {
  assert.deepEqual(purchaseProps(order, { method: "upi", path: "webhook" }), {
    order_id: "TAN-9",
    amount_paise: 37300,
    method: "upi",
    capture_path: "webhook",
    src: "box",
  });
  // charge_paise wins over total_paise when the finalize path set it.
  assert.equal(purchaseProps({ ...order, chargePaise: 30000 }, { method: "card", path: "verify" }).amount_paise, 30000);
  // Direct traffic carries no src key at all — not an empty string.
  assert.equal("src" in purchaseProps({ ...order, acquisitionSrc: null }, { method: "upi", path: "verify" }), false);
  // A row with no external id still keys the event.
  assert.equal(purchaseProps({ ...order, externalOrderId: null }, { method: "upi", path: "verify" }).order_id, "order-9");
});

test("payment_failed records the gateway's code and a bounded reason", () => {
  const p = paymentFailedProps(order, { method: "upi", errorCode: "BAD_REQUEST_ERROR", errorReason: "x".repeat(300) });
  assert.equal(p.error_code, "BAD_REQUEST_ERROR");
  assert.equal((p.reason as string).length, 128);
  assert.equal(p.method, "upi");
  assert.equal(paymentFailedProps(order, { method: null, errorCode: null, errorReason: null }).error_code, "unknown");
});
