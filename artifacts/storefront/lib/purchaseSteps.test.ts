import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./apiClient";
import { consultSteps, marketplaceSteps, premiumSteps } from "./purchaseSteps";
import { VERIFY_ATTEMPTS } from "./verifyRetry";
import type { RazorpayAdapter } from "./moneyPath";

// The contract: every secondary money path creates once, pays once, retries a
// TRANSIENT verify failure in place, and — when verify still cannot be
// confirmed — reports "captured" so the runner shows recovery instead of
// re-offering the pay CTA. The two paths whose verify endpoint guards on
// pending→paid resolve `settled` by READING the authoritative state, never by
// replaying the verify.

const PAID = {
  razorpayPaymentId: "pay_1",
  razorpayOrderId: "order_1",
  razorpaySignature: "sig_1",
};

function fakeRazorpay(): RazorpayAdapter & { opened: number } {
  const rzp = {
    opened: 0,
    open: async () => {
      rzp.opened += 1;
      return PAID;
    },
  };
  return rzp;
}

/** A fetchImpl that answers each path from a table and counts the calls. */
function fakeFetch(routes: Record<string, () => unknown>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = new URL(url, "https://x").pathname.replace(/^\/api/, "");
    calls.push(`${init?.method ?? "GET"} ${path}`);
    const handler = routes[path];
    if (!handler) throw new Error(`unrouted ${path}`);
    const body = handler();
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("premium pays once and verifies once on the happy path", async () => {
  const { impl, calls } = fakeFetch({
    "/premium/checkout": () => ({
      razorpayOrderId: "order_1",
      amount: 49900,
      currency: "INR",
      keyId: "rzp_test",
    }),
    "/premium/verify": () => ({ membership: { status: "active" }, isPremium: true }),
  });
  const steps = premiumSteps("Pay", impl);
  const rzp = fakeRazorpay();
  const captured: boolean[] = [];

  const order = await steps.create();
  await steps.pay(order, rzp, () => captured.push(true));

  assert.equal(rzp.opened, 1);
  assert.deepEqual(captured, [true]);
  assert.deepEqual(calls, ["POST /premium/checkout", "POST /premium/verify"]);
});

test("premium signals capture BEFORE verify, so a verify failure is recoverable", async () => {
  let order = 0;
  const { impl } = fakeFetch({
    "/premium/checkout": () => ({
      razorpayOrderId: `order_${++order}`,
      amount: 49900,
      currency: "INR",
      keyId: "rzp_test",
    }),
    "/premium/verify": () => new Error("network down"),
  });
  const steps = premiumSteps("Pay", impl);
  let capturedAt = -1;
  let step = 0;

  await assert.rejects(
    steps.pay(await steps.create(), fakeRazorpay(), () => {
      capturedAt = step++;
    }),
  );
  assert.equal(capturedAt, 0, "onCaptured must fire the instant the modal resolves");
});

test("a transient premium verify failure is retried in place, not surfaced", async () => {
  let verifyCalls = 0;
  const { impl } = fakeFetch({
    "/premium/checkout": () => ({
      razorpayOrderId: "order_1",
      amount: 49900,
      currency: "INR",
      keyId: "rzp_test",
    }),
    "/premium/verify": () => {
      verifyCalls += 1;
      if (verifyCalls < VERIFY_ATTEMPTS) return new Error("blip");
      return { membership: { status: "active" }, isPremium: true };
    },
  });
  const steps = premiumSteps("Pay", impl);
  await steps.pay(await steps.create(), fakeRazorpay(), () => {});
  assert.equal(verifyCalls, VERIFY_ATTEMPTS);
});

test("premium resolves settled by READING the membership, never by replaying verify", async () => {
  const { impl, calls } = fakeFetch({
    "/premium/me": () => ({ membership: null, isPremium: true, pricePaise: 49900 }),
  });
  assert.equal(await premiumSteps("Pay", impl).settled(null, null), true);
  assert.deepEqual(calls, ["GET /premium/me"]);
});

test("premium settled is false when the server says the membership never activated", async () => {
  const { impl } = fakeFetch({
    "/premium/me": () => ({ membership: null, isPremium: false, pricePaise: 49900 }),
  });
  assert.equal(await premiumSteps("Pay", impl).settled(null, null), false);
});

const APPT = {
  id: 7,
  rdSlug: "rd-asha",
  kind: "follow_up_30m",
  startAt: "2026-09-10T05:30:00.000Z",
  endAt: "2026-09-10T06:00:00.000Z",
  pricePaise: 89900,
  paymentStatus: "pending" as const,
  status: "booked",
};

test("a consult pays for the appointment it was given — it never books a second one", async () => {
  const { impl, calls } = fakeFetch({
    "/rd/appointments/7/checkout": () => ({
      razorpayOrderId: "order_1",
      amount: 89900,
      currency: "INR",
      keyId: "rzp_test",
    }),
    "/rd/appointments/7/verify": () => ({ appointment: { ...APPT, paymentStatus: "paid" } }),
  });
  const steps = consultSteps(APPT, "Pay", impl);
  const rzp = fakeRazorpay();

  await steps.pay(await steps.create(), rzp, () => {});

  assert.equal(rzp.opened, 1);
  assert.deepEqual(calls, [
    "POST /rd/appointments/7/checkout",
    "POST /rd/appointments/7/verify",
  ]);
  assert.ok(!calls.some((c) => c === "POST /rd/appointments"), "must not re-book");
});

test("a consult resolves settled by reading the appointment's own payment status", async () => {
  const paid = fakeFetch({
    "/rd/appointments": () => ({ appointments: [{ ...APPT, paymentStatus: "paid" }] }),
  });
  assert.equal(await consultSteps(APPT, "Pay", paid.impl).settled(APPT, null), true);
  assert.deepEqual(paid.calls, ["GET /rd/appointments"]);

  const stillPending = fakeFetch({
    "/rd/appointments": () => ({ appointments: [APPT] }),
  });
  assert.equal(await consultSteps(APPT, "Pay", stillPending.impl).settled(APPT, null), false);
});

test("a consult is not settled by SOMEONE ELSE's paid appointment", async () => {
  const { impl } = fakeFetch({
    "/rd/appointments": () => ({ appointments: [{ ...APPT, id: 8, paymentStatus: "paid" }] }),
  });
  assert.equal(await consultSteps(APPT, "Pay", impl).settled(APPT, null), false);
});

test("a 4xx verify verdict is NOT retried — an invalid signature stays invalid", async () => {
  let verifyCalls = 0;
  const { impl } = fakeFetch({
    "/premium/checkout": () => ({
      razorpayOrderId: "order_1",
      amount: 49900,
      currency: "INR",
      keyId: "rzp_test",
    }),
    "/premium/verify": () => {
      verifyCalls += 1;
      return new ApiError(400, "invalid_signature", "invalid payment signature");
    },
  });
  const steps = premiumSteps("Pay", impl);
  await assert.rejects(steps.pay(await steps.create(), fakeRazorpay(), () => {}));
  assert.equal(verifyCalls, 1);
});

test("the marketplace create reuses ONE idempotency key across the whole attempt", async () => {
  const keys: (string | null)[] = [];
  const impl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    keys.push(headers.get("Idempotency-Key"));
    return new Response(
      JSON.stringify({ order: { id: 1, externalOrderId: "ord_1", status: "created", totalPaise: 100 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  const steps = marketplaceSteps({ id: 3, name: "Ghee" }, 2, "key-abc", "Pay", impl);
  await steps.create();
  await steps.create(); // a retried create must replay, not mint a second order
  assert.deepEqual(keys, ["key-abc", "key-abc"]);
});

test("a marketplace purchase lands on its own confirmation, and a lost handle lands on orders", () => {
  const steps = marketplaceSteps({ id: 3, name: "Ghee" }, 1, "k", "Pay");
  assert.equal(
    steps.destination({ id: 1, externalOrderId: "ord/1", status: "created", totalPaise: 100 }),
    "/order/confirmed/ord%2F1",
  );
  assert.equal(steps.destination(null), "/account/orders");
});
