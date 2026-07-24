// Money-path client + orchestration invariants (slice 5). No network — a fake
// fetch and fake deps stand in. Run with the api-server tsx loader:
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/api.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { API_BASE, ApiError, apiPost, quotePlan, createRazorpayOrder, getCreditBalance } from "./api";
import { runCheckout, finishPlanPayment, type RazorpayAdapter, type MoneyPathDeps } from "./moneyPath";

function fakeFetch(status: number, payload: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => JSON.stringify(payload),
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("apiPost hits /api<path>, sends cookies + JSON, returns parsed body", async () => {
  const { impl, calls } = fakeFetch(200, { totalPaise: 437800 });
  const out = await apiPost<{ totalPaise: number }>("/subscriptions/quote", { planId: "desk_fuel" }, impl);
  assert.equal(out.totalPaise, 437800);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, `${API_BASE}/api/subscriptions/quote`);
  assert.equal(calls[0]?.init.method, "POST");
  assert.equal(calls[0]?.init.credentials, "include");
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { planId: "desk_fuel" });
});

test("apiPost throws a typed ApiError carrying the server status + code", async () => {
  const { impl } = fakeFetch(422, { error: "plan not launchable", code: "plan_not_launchable" });
  await assert.rejects(
    () => apiPost("/subscriptions", { planId: "steady" }, impl),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 422);
      assert.equal(err.code, "plan_not_launchable");
      return true;
    },
  );
});

test("quotePlan sends the plan-v2 fields with a monthly default cadence", async () => {
  const { impl, calls } = fakeFetch(200, { totalPaise: 437800, gstPaise: 0, mealsPerDelivery: 22, pricePerDeliveryPaise: 437800, pricePerMealPaise: 19900 });
  await quotePlan({ planId: "desk_fuel", track: "veg", addOns: ["rd_bump"] }, impl);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    cadence: "monthly",
    planId: "desk_fuel",
    track: "veg",
    addOns: ["rd_bump"],
  });
});

test("createRazorpayOrder posts only the order ref — never a client amount", async () => {
  const { impl, calls } = fakeFetch(200, { razorpayOrderId: "order_x", amount: 437800, currency: "INR", keyId: "rzp_test" });
  await createRazorpayOrder({ orderId: "sub-42", subscriptionId: 42 }, impl);
  const body = JSON.parse(String(calls[0]?.init.body));
  assert.deepEqual(body, { orderId: "sub-42", subscriptionId: 42 });
  assert.equal("amountPaise" in body, false);
});

test("getCreditBalance reads GET /credit-ledger with cookies, no body", async () => {
  const { impl, calls } = fakeFetch(200, { balancePaise: 39900 });
  const out = await getCreditBalance(impl);
  assert.equal(out.balancePaise, 39900);
  assert.equal(calls[0]?.url, `${API_BASE}/api/credit-ledger`);
  assert.equal(calls[0]?.init.method, "GET");
  assert.equal(calls[0]?.init.credentials, "include");
});

test("runCheckout's onCreated ref carries the server's creditAppliedPaise", async () => {
  const deps: MoneyPathDeps = {
    createSubscription: async () => ({
      subscription: { id: 7, externalOrderId: "sub-7" },
      deliveries: [],
      bridgeCreditPaise: 0,
      creditAppliedPaise: 39900,
    }),
    createRazorpayOrder: async () => ({ razorpayOrderId: "order_9", amount: 340100, currency: "INR", keyId: "rzp_test" }),
    verifyPayment: async (input) => ({ ok: true, orderId: input.orderId, status: "preparing" }),
  };
  const razorpay: RazorpayAdapter = {
    open: async (order) => ({ razorpayPaymentId: "pay_1", razorpayOrderId: order.razorpayOrderId, razorpaySignature: "sig" }),
  };
  let seenCredit: number | undefined;
  await runCheckout(
    {
      subscription: { planId: "desk_fuel", track: "veg", cadence: "monthly", mealsPerDelivery: 22, deliveryWindow: "12:30-13:30", startDate: "2026-08-01", members: [{ name: "Asha" }] },
      razorpay,
      onCreated: (ref) => { seenCredit = ref.creditAppliedPaise; },
    },
    deps,
  );
  assert.equal(seenCredit, 39900);
});

test("runCheckout sequences create → order → modal → verify and returns the verified result", async () => {
  const seen: string[] = [];
  const deps: MoneyPathDeps = {
    createSubscription: async () => {
      seen.push("create");
      return { subscription: { id: 7, externalOrderId: "sub-7" }, deliveries: [], bridgeCreditPaise: 0 };
    },
    createRazorpayOrder: async (input) => {
      seen.push("order");
      assert.equal(input.orderId, "sub-7");
      return { razorpayOrderId: "order_9", amount: 437800, currency: "INR", keyId: "rzp_test" };
    },
    verifyPayment: async (input) => {
      seen.push("verify");
      assert.equal(input.razorpayOrderId, "order_9");
      return { ok: true, orderId: input.orderId, status: "preparing" };
    },
  };
  const razorpay: RazorpayAdapter = {
    open: async (order) => {
      seen.push("modal");
      return { razorpayPaymentId: "pay_1", razorpayOrderId: order.razorpayOrderId, razorpaySignature: "sig" };
    },
  };

  const result = await runCheckout(
    { subscription: { planId: "desk_fuel", track: "veg", cadence: "monthly", mealsPerDelivery: 22, deliveryWindow: "12:30-13:30", startDate: "2026-08-01", members: [{ name: "Asha" }] }, razorpay },
    deps,
  );
  assert.deepEqual(seen, ["create", "order", "modal", "verify"]);
  assert.equal(result.orderId, "sub-7");
  assert.equal(result.status, "preparing");
});

test("runCheckout fires onCreated with the subscription order before any payment step", async () => {
  const seen: string[] = [];
  let createdOrderId: string | null = null;
  const deps: MoneyPathDeps = {
    createSubscription: async () => {
      seen.push("create");
      return { subscription: { id: 7, externalOrderId: "sub-7" }, deliveries: [], bridgeCreditPaise: 0 };
    },
    createRazorpayOrder: async () => {
      seen.push("order");
      return { razorpayOrderId: "order_9", amount: 437800, currency: "INR", keyId: "rzp_test" };
    },
    verifyPayment: async (input) => {
      seen.push("verify");
      return { ok: true, orderId: input.orderId, status: "preparing" };
    },
  };
  const razorpay: RazorpayAdapter = {
    open: async (order) => {
      seen.push("modal");
      return { razorpayPaymentId: "pay_1", razorpayOrderId: order.razorpayOrderId, razorpaySignature: "sig" };
    },
  };
  await runCheckout(
    {
      subscription: { planId: "desk_fuel", track: "veg", cadence: "monthly", mealsPerDelivery: 22, deliveryWindow: "12:30-13:30", startDate: "2026-08-01", members: [{ name: "Asha" }] },
      razorpay,
      onCreated: (ref) => { createdOrderId = ref.orderId; seen.push("onCreated"); },
    },
    deps,
  );
  assert.equal(createdOrderId, "sub-7");
  assert.deepEqual(seen, ["create", "onCreated", "order", "modal", "verify"]);
});

test("finishPlanPayment resumes an already-created subscription — pays it WITHOUT re-creating", async () => {
  const seen: string[] = [];
  const deps: MoneyPathDeps = {
    createSubscription: async () => { seen.push("create"); throw new Error("must not create on resume"); },
    createRazorpayOrder: async (input) => {
      seen.push("order");
      assert.equal(input.orderId, "sub-7");
      assert.equal(input.subscriptionId, 7);
      return { razorpayOrderId: "order_9", amount: 437800, currency: "INR", keyId: "rzp_test" };
    },
    verifyPayment: async (input) => { seen.push("verify"); return { ok: true, orderId: input.orderId, status: "preparing" }; },
  };
  const razorpay: RazorpayAdapter = {
    open: async (order) => { seen.push("modal"); return { razorpayPaymentId: "pay_2", razorpayOrderId: order.razorpayOrderId, razorpaySignature: "sig2" }; },
  };
  const result = await finishPlanPayment({ orderId: "sub-7", subscriptionId: 7 }, razorpay, deps);
  assert.deepEqual(seen, ["order", "modal", "verify"]); // no "create"
  assert.equal(result.orderId, "sub-7");
  assert.equal(result.status, "preparing");
});

test("runCheckout stops at the modal if the user dismisses it — no verify call", async () => {
  const seen: string[] = [];
  const deps: MoneyPathDeps = {
    createSubscription: async () => {
      seen.push("create");
      return { subscription: { id: 7 }, deliveries: [], bridgeCreditPaise: 0 };
    },
    createRazorpayOrder: async () => {
      seen.push("order");
      return { razorpayOrderId: "order_9", amount: 437800, currency: "INR", keyId: "rzp_test" };
    },
    verifyPayment: async () => {
      seen.push("verify");
      return { ok: true, orderId: "sub-7", status: "preparing" };
    },
  };
  const razorpay: RazorpayAdapter = {
    open: async () => {
      throw new Error("dismissed");
    },
  };

  await assert.rejects(
    () =>
      runCheckout(
        { subscription: { planId: "desk_fuel", track: "veg", cadence: "monthly", mealsPerDelivery: 22, deliveryWindow: "12:30-13:30", startDate: "2026-08-01", members: [{ name: "Asha" }] }, razorpay },
        deps,
      ),
    /dismissed/,
  );
  assert.deepEqual(seen, ["create", "order"]);
  assert.equal(seen.includes("verify"), false);
});
