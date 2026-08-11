/**
 * Plan-subscription money-path orchestration, tested through the injectable
 * seams (no network) — the plan-side counterpart to moneyPath.alacarte.test.ts.
 * Covers the baseline create → rzp order → modal → verify sequence, plus the
 * zero-payable settlement branch (DEF-RECON-ZEROPAYABLE-001,
 * docs/reconciliation/defects.md): a subscription's first cycle fully covered
 * by credit at creation must never reach POST /payments/razorpay/order — the
 * server 409s "order has no payable amount" for exactly that case.
 * Run: node --test --import tsx ../storefront/lib/moneyPath.plan.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runCheckout, finishPlanPayment, type MoneyPathDeps, type RazorpayAdapter, type PlanOrderRef } from "./moneyPath";
import type { CreateSubscriptionInput } from "./api";

const SUBSCRIPTION_INPUT: CreateSubscriptionInput = {
  planId: "desk_fuel",
  track: "veg",
  cadence: "weekly",
  mealsPerDelivery: 5,
  deliveryWindow: "12:00-14:00",
  startDate: "2026-08-20",
  members: [{ name: "Primary", diet: "veg" }],
};

function makeDeps(calls: string[], opts?: { settled?: boolean; chargePaise?: number }): MoneyPathDeps {
  return {
    createSubscription: async (body) => {
      calls.push("create");
      // §4.3: the create body must never carry a client-computed total.
      assert.ok(!("totalPaise" in body), "client must not send a total");
      assert.ok(!("chargePaise" in body), "client must not send a charge");
      return {
        subscription: { id: 42, externalOrderId: "sub-42" },
        deliveries: [],
        bridgeCreditPaise: 0,
        creditAppliedPaise: 0,
        chargePaise: opts?.chargePaise ?? 129900,
        settled: opts?.settled ?? false,
      };
    },
    createRazorpayOrder: async (input) => {
      calls.push("rzp-order");
      assert.deepEqual(input, { orderId: "sub-42", subscriptionId: 42 }); // ids only — no amount
      return { razorpayOrderId: "rzp_plan_abc", amount: 129900, currency: "INR", keyId: "key_x" };
    },
    verifyPayment: async (input) => {
      calls.push("verify");
      assert.equal(input.orderId, "sub-42");
      assert.equal(input.razorpayOrderId, "rzp_plan_abc");
      return { ok: true, orderId: "sub-42", status: "preparing" };
    },
  };
}

const payingAdapter: RazorpayAdapter = {
  open: async (order) => {
    assert.equal(order.amount, 129900); // the modal shows the SERVER amount
    return {
      razorpayPaymentId: "pay_plan_1",
      razorpayOrderId: order.razorpayOrderId,
      razorpaySignature: "sig_plan_1",
    };
  },
};

// ── Baseline: a payable subscription (the common case, unit-untested until now) ──

test("happy path: create → rzp order → modal → verify, ids threaded", async () => {
  const calls: string[] = [];
  const result = await runCheckout(
    { subscription: SUBSCRIPTION_INPUT, razorpay: payingAdapter },
    makeDeps(calls),
  );
  assert.deepEqual(calls, ["create", "rzp-order", "verify"]);
  assert.equal(result.orderId, "sub-42");
  assert.equal(result.status, "preparing");
});

test("dismissed modal: verify is NEVER called, the rejection propagates", async () => {
  const calls: string[] = [];
  const dismissingAdapter: RazorpayAdapter = {
    open: async () => {
      throw new Error("payment_dismissed");
    },
  };
  await assert.rejects(
    runCheckout({ subscription: SUBSCRIPTION_INPUT, razorpay: dismissingAdapter }, makeDeps(calls)),
    /payment_dismissed/,
  );
  assert.deepEqual(calls, ["create", "rzp-order"]); // no verify
});

test("onCreated fires with the server subscription the instant it is created, before any payment step", async () => {
  const calls: string[] = [];
  let createdRef: PlanOrderRef | null = null;
  await runCheckout(
    {
      subscription: SUBSCRIPTION_INPUT,
      razorpay: payingAdapter,
      onCreated: (ref) => {
        createdRef = ref;
        calls.push("onCreated");
      },
    },
    makeDeps(calls),
  );
  assert.equal(createdRef!.orderId, "sub-42");
  assert.equal(createdRef!.settled, false);
  assert.deepEqual(calls, ["create", "onCreated", "rzp-order", "verify"]);
});

test("finishPlanPayment resumes an already-created subscription — pays it WITHOUT re-creating", async () => {
  const calls: string[] = [];
  const result = await finishPlanPayment(
    { orderId: "sub-42", subscriptionId: 42 },
    payingAdapter,
    makeDeps(calls),
  );
  // No "create" — the subscription already exists; a re-create would create a second one.
  assert.deepEqual(calls, ["rzp-order", "verify"]);
  assert.equal(result.orderId, "sub-42");
  assert.equal(result.status, "preparing");
});

// ── Zero-payable settlement (DEF-RECON-ZEROPAYABLE-001) ──────────────────────

test("settled subscription: no Razorpay order, no modal, no verify — resolves straight from ref", async () => {
  const calls: string[] = [];
  const neverOpen: RazorpayAdapter = {
    open: async () => {
      throw new Error("razorpay.open must never be called for a settled subscription");
    },
  };
  const result = await runCheckout(
    { subscription: SUBSCRIPTION_INPUT, razorpay: neverOpen },
    makeDeps(calls, { settled: true, chargePaise: 0 }),
  );
  assert.deepEqual(calls, ["create"]); // no rzp-order, no verify
  assert.equal(result.orderId, "sub-42");
  assert.equal(result.status, "preparing");
});

test("onCreated receives settled:true for a fully-credited subscription", async () => {
  const calls: string[] = [];
  let createdRef: PlanOrderRef | null = null;
  await runCheckout(
    {
      subscription: SUBSCRIPTION_INPUT,
      razorpay: payingAdapter,
      onCreated: (ref) => {
        createdRef = ref;
      },
    },
    makeDeps(calls, { settled: true, chargePaise: 0 }),
  );
  assert.equal(createdRef!.settled, true);
});

test("finishPlanPayment called directly with a settled ref also skips the gateway (defensive — same guard as runCheckout)", async () => {
  const calls: string[] = [];
  const neverOpen: RazorpayAdapter = {
    open: async () => {
      throw new Error("razorpay.open must never be called for a settled subscription");
    },
  };
  const result = await finishPlanPayment(
    { orderId: "sub-42", subscriptionId: 42, settled: true },
    neverOpen,
    makeDeps(calls),
  );
  assert.deepEqual(calls, []); // nothing money-shaped happened at all
  assert.equal(result.orderId, "sub-42");
  assert.equal(result.status, "preparing");
});

test("settled:false (or absent) always goes through the gateway — the safe default", async () => {
  const calls: string[] = [];
  const result = await finishPlanPayment(
    { orderId: "sub-42", subscriptionId: 42 }, // settled omitted entirely
    payingAdapter,
    makeDeps(calls),
  );
  assert.deepEqual(calls, ["rzp-order", "verify"]);
  assert.equal(result.status, "preparing");
});
