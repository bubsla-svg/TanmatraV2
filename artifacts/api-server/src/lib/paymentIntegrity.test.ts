// Unit tests for pure payment-integrity decisions (no DB).
// Run: node --test --import tsx ./src/lib/paymentIntegrity.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCaptureAmountReconciled,
  REFUND_EVENT_NAMES,
  refundedSoFarPaise,
  remainingRefundablePaise,
  resolvePayableAmountPaise,
} from "./paymentIntegrity.js";

test("resolvePayableAmountPaise: chargePaise wins over totalPaise", () => {
  assert.equal(resolvePayableAmountPaise({ chargePaise: 45000, totalPaise: 99999 }), 45000);
});

test("resolvePayableAmountPaise: falls back to totalPaise when chargePaise null", () => {
  assert.equal(resolvePayableAmountPaise({ chargePaise: null, totalPaise: 34580 }), 34580);
});

test("resolvePayableAmountPaise: null when both missing", () => {
  assert.equal(resolvePayableAmountPaise({ chargePaise: null, totalPaise: null }), null);
});

test("resolvePayableAmountPaise: null for non-positive / non-integer", () => {
  assert.equal(resolvePayableAmountPaise({ chargePaise: 0, totalPaise: null }), null);
  assert.equal(resolvePayableAmountPaise({ chargePaise: -100, totalPaise: null }), null);
  assert.equal(resolvePayableAmountPaise({ chargePaise: 12.5, totalPaise: null }), null);
});

test("isCaptureAmountReconciled: equal amounts confirm", () => {
  assert.equal(isCaptureAmountReconciled(45000, 45000), true);
});

test("isCaptureAmountReconciled: underpayment does NOT confirm (the ₹1-for-any-order attack)", () => {
  assert.equal(isCaptureAmountReconciled(45000, 100), false);
});

test("isCaptureAmountReconciled: overpayment does NOT confirm", () => {
  assert.equal(isCaptureAmountReconciled(45000, 90000), false);
});

test("isCaptureAmountReconciled: unknown expected or captured defers (true)", () => {
  assert.equal(isCaptureAmountReconciled(null, 45000), true);
  assert.equal(isCaptureAmountReconciled(45000, null), true);
  assert.equal(isCaptureAmountReconciled(null, null), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Refund authority.
//
// These pin the arithmetic behind "how much may still be refunded on this
// order". The DB-backed half — that the ops agent's refund_order tool actually
// consults this, and reads BOTH refund event dialects when it does — lives in
// lib/ai/agents/ops.refundCap.test.ts — it needs real rows to be a real test.
// ─────────────────────────────────────────────────────────────────────────────

test("REFUND_EVENT_NAMES covers both dialects that record a refund", () => {
  // routes/refunds.ts writes order_refunded; ai/agents/ops.ts writes
  // refund_issued. A reader that knows only one nets off nothing for refunds
  // the other path issued. If a third writer appears, it belongs here — and
  // this assertion is what will fail to say so.
  assert.deepEqual([...REFUND_EVENT_NAMES].sort(), ["order_refunded", "refund_issued"]);
});

test("refundedSoFarPaise: no refund events is a genuine zero", () => {
  assert.equal(refundedSoFarPaise([]), 0);
});

test("refundedSoFarPaise: sums every event's amount", () => {
  assert.equal(
    refundedSoFarPaise([
      { meta: { amountPaise: 10000, reason: "late" } },
      { meta: { amountPaise: 5000, razorpayRefundId: "rfnd_x" } },
    ]),
    15000,
  );
});

test("refundedSoFarPaise: an unreadable amount is null, NOT skipped", () => {
  // Skipping would under-count what has gone back and over-permit what may go
  // back next — the fail-open this function exists to refuse.
  assert.equal(refundedSoFarPaise([{ meta: { reason: "late" } }]), null);
  assert.equal(refundedSoFarPaise([{ meta: null }]), null);
  assert.equal(refundedSoFarPaise([{ meta: { amountPaise: "5000" } }]), null);
  assert.equal(refundedSoFarPaise([{ meta: { amountPaise: 12.5 } }]), null);
  assert.equal(refundedSoFarPaise([{ meta: { amountPaise: 0 } }]), null);
  assert.equal(refundedSoFarPaise([{ meta: { amountPaise: -5000 } }]), null);
});

test("refundedSoFarPaise: one unreadable event poisons an otherwise readable set", () => {
  assert.equal(
    refundedSoFarPaise([{ meta: { amountPaise: 10000 } }, { meta: { reason: "late" } }]),
    null,
  );
});

test("remainingRefundablePaise: caps at chargePaise, not totalPaise", () => {
  // THE headline defect. total_paise is the meal subtotal — no GST, no
  // delivery fee — and charge_paise is what was billed. Capping at 40000 on an
  // order charged 51200 refuses to return ₹112 of the customer's own money.
  const order = { chargePaise: 51200, totalPaise: 40000 };
  assert.equal(remainingRefundablePaise(order, []), 51200);
});

test("remainingRefundablePaise: falls back to totalPaise when chargePaise is null", () => {
  // Legacy + guest-checkout rows, whose total_paise already includes GST+fee.
  assert.equal(remainingRefundablePaise({ chargePaise: null, totalPaise: 34580 }, []), 34580);
});

test("remainingRefundablePaise: subtracts refunds already issued", () => {
  const order = { chargePaise: 51200, totalPaise: 40000 };
  assert.equal(remainingRefundablePaise(order, [{ meta: { amountPaise: 20000 } }]), 31200);
});

test("remainingRefundablePaise: a fully refunded order has nothing left", () => {
  // The repeat-refund hole: without this, the same full-value refund passes a
  // total-only cap once, twice, five times. Each call was individually "valid".
  const order = { chargePaise: 51200, totalPaise: 40000 };
  assert.equal(remainingRefundablePaise(order, [{ meta: { amountPaise: 51200 } }]), 0);
});

test("remainingRefundablePaise: partial refunds from both paths net together", () => {
  // The console refunded ₹200 and this tool refunded ₹100; ₹212 is left.
  const order = { chargePaise: 51200, totalPaise: 40000 };
  assert.equal(
    remainingRefundablePaise(order, [
      { meta: { amountPaise: 20000, razorpayRefundId: "rfnd_x" } },
      { meta: { amountPaise: 10000, operatorId: "ops-1" } },
    ]),
    21200,
  );
});

test("remainingRefundablePaise: an over-refunded order clamps to 0, never negative", () => {
  const order = { chargePaise: 51200, totalPaise: 40000 };
  assert.equal(remainingRefundablePaise(order, [{ meta: { amountPaise: 90000 } }]), 0);
});

test("remainingRefundablePaise: null when the order has no resolvable payable amount", () => {
  assert.equal(remainingRefundablePaise({ chargePaise: null, totalPaise: null }, []), null);
  assert.equal(remainingRefundablePaise({ chargePaise: 0, totalPaise: null }, []), null);
});

test("remainingRefundablePaise: null when the refund history is unreadable", () => {
  const order = { chargePaise: 51200, totalPaise: 40000 };
  assert.equal(remainingRefundablePaise(order, [{ meta: { reason: "late" } }]), null);
});
