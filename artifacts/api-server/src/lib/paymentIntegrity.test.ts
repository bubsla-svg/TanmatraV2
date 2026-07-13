// Unit tests for pure payment-integrity decisions (no DB).
// Run: node --test --import tsx ./src/lib/paymentIntegrity.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isCaptureAmountReconciled, resolvePayableAmountPaise } from "./paymentIntegrity.js";

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
