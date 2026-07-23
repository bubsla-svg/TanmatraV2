/**
 * SF-05 — à-la-carte money-path orchestration, tested through the injectable
 * seams (no network). The invariants under test are the §4.3 hard rules:
 * the client never sends a price, the server's ids thread every step, and a
 * dismissed modal never reaches verify.
 * Run: node --test --import tsx ../storefront/lib/moneyPath.alacarte.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  runAlacarteCheckout,
  finishAlacartePayment,
  type AlacartePathDeps,
  type RazorpayAdapter,
} from "./moneyPath";
import type { AlacarteOrderInput } from "./api";

const ORDER_INPUT: AlacarteOrderInput = {
  externalOrderId: "alc-test-0001",
  items: [{ dishId: 7, qty: 2 }],
  phone: "+919999999999",
  address: { line1: "Tower 4", city: "Noida", pincode: "201301" },
  consent: { accepted: true, policyVersion: "v1" },
};

function makeDeps(calls: string[]): AlacartePathDeps {
  return {
    createAlacarteOrder: async (body) => {
      calls.push("create");
      assert.equal(body.externalOrderId, "alc-test-0001");
      // §4.3: the create body must never carry a client-computed total.
      assert.ok(!("totalPaise" in body), "client must not send a total");
      assert.ok(!("amountPaise" in body), "client must not send an amount");
      return {
        orderId: body.externalOrderId,
        serverOrderId: 42,
        status: "placed",
        etaMinutes: 25,
        totalPaise: 41800, // the server's number
      };
    },
    createRazorpayOrder: async (input) => {
      calls.push("rzp-order");
      assert.deepEqual(input, { orderId: "alc-test-0001" }); // id only — no amount
      return { razorpayOrderId: "rzp_abc", amount: 41800, currency: "INR", keyId: "key_x" };
    },
    verifyPayment: async (input) => {
      calls.push("verify");
      assert.equal(input.orderId, "alc-test-0001");
      assert.equal(input.razorpayOrderId, "rzp_abc");
      return { ok: true, orderId: "alc-test-0001", status: "preparing" };
    },
  };
}

const payingAdapter: RazorpayAdapter = {
  open: async (order) => {
    assert.equal(order.amount, 41800); // the modal shows the SERVER amount
    return {
      razorpayPaymentId: "pay_1",
      razorpayOrderId: order.razorpayOrderId,
      razorpaySignature: "sig_1",
    };
  },
};

test("happy path: create → rzp order → modal → verify, ids threaded, server total returned", async () => {
  const calls: string[] = [];
  const result = await runAlacarteCheckout(
    { order: ORDER_INPUT, razorpay: payingAdapter },
    makeDeps(calls),
  );
  assert.deepEqual(calls, ["create", "rzp-order", "verify"]);
  assert.equal(result.orderId, "alc-test-0001");
  assert.equal(result.status, "preparing");
  assert.equal(result.totalPaise, 41800);
  assert.equal(result.etaMinutes, 25);
});

test("dismissed modal: verify is NEVER called, the rejection propagates", async () => {
  const calls: string[] = [];
  const dismissingAdapter: RazorpayAdapter = {
    open: async () => {
      throw new Error("payment_dismissed");
    },
  };
  await assert.rejects(
    runAlacarteCheckout({ order: ORDER_INPUT, razorpay: dismissingAdapter }, makeDeps(calls)),
    /payment_dismissed/,
  );
  assert.deepEqual(calls, ["create", "rzp-order"]); // no verify
});

test("onCreated fires with the server order the instant it is created, before any payment step", async () => {
  const calls: string[] = [];
  let createdOrderId: string | null = null;
  await runAlacarteCheckout(
    {
      order: ORDER_INPUT,
      razorpay: payingAdapter,
      onCreated: (o) => {
        createdOrderId = o.orderId;
        calls.push("onCreated");
      },
    },
    makeDeps(calls),
  );
  assert.equal(createdOrderId, "alc-test-0001");
  assert.deepEqual(calls, ["create", "onCreated", "rzp-order", "verify"]);
});

test("finishAlacartePayment resumes an already-created order — pays it WITHOUT re-creating", async () => {
  const calls: string[] = [];
  const result = await finishAlacartePayment(
    { orderId: "alc-test-0001", totalPaise: 41800, etaMinutes: 25 },
    payingAdapter,
    makeDeps(calls),
  );
  // No "create" — the row already exists; a re-create would 409 on the server.
  assert.deepEqual(calls, ["rzp-order", "verify"]);
  assert.equal(result.orderId, "alc-test-0001");
  assert.equal(result.status, "preparing");
  assert.equal(result.totalPaise, 41800);
  assert.equal(result.etaMinutes, 25);
});

test("server rejection at create (e.g. 422 unserviceable) propagates before any payment step", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls);
  deps.createAlacarteOrder = async () => {
    calls.push("create");
    throw Object.assign(new Error("unserviceable_pincode"), { status: 422 });
  };
  await assert.rejects(
    runAlacarteCheckout({ order: ORDER_INPUT, razorpay: payingAdapter }, deps),
    /unserviceable_pincode/,
  );
  assert.deepEqual(calls, ["create"]); // nothing money-shaped happened
});
