import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSlots, bookAppointment, checkoutAppointment, verifyAppointment, payForAppointment,
  type Appointment,
} from "./rdBookingApi";
import type { RazorpayAdapter } from "./moneyPath";

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const APPT: Appointment = {
  id: 7, rdSlug: "rd-anjali-nair", kind: "follow_up_30m",
  startAt: "2026-08-01T05:30:00.000Z", endAt: "2026-08-01T06:00:00.000Z",
  pricePaise: 120000, paymentStatus: "pending", status: "scheduled",
};

/** A fetch fake that records calls and routes by URL + method. */
function fakeFetch(routes: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    return routes(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("getSlots: GETs /rd/slots with rdSlug+kind and unwraps { slots }", async () => {
  const { impl, calls } = fakeFetch(() => jsonRes({ slots: [{ startAt: "a", endAt: "b" }] }));
  const slots = await getSlots("rd-anjali-nair", "follow_up_30m", impl);
  assert.match(calls[0]!.url, /\/api\/rd\/slots\?rdSlug=rd-anjali-nair&kind=follow_up_30m$/);
  assert.equal(calls[0]!.method, "GET");
  assert.equal(slots.length, 1);
});

test("bookAppointment: POSTs the booking and unwraps { appointment }", async () => {
  const { impl, calls } = fakeFetch(() => jsonRes({ appointment: APPT }));
  const appt = await bookAppointment(
    { rdSlug: "rd-anjali-nair", kind: "follow_up_30m", startAt: "s", endAt: "e" }, impl,
  );
  assert.match(calls[0]!.url, /\/api\/rd\/appointments$/);
  assert.equal(calls[0]!.method, "POST");
  assert.deepEqual(calls[0]!.body, { rdSlug: "rd-anjali-nair", kind: "follow_up_30m", startAt: "s", endAt: "e" });
  assert.equal(appt.id, 7);
});

test("checkoutAppointment: POSTs to /:id/checkout and returns the order", async () => {
  const order = { razorpayOrderId: "order_x", amount: 120000, currency: "INR", keyId: "key_x" };
  const { impl, calls } = fakeFetch(() => jsonRes(order));
  const got = await checkoutAppointment(7, impl);
  assert.match(calls[0]!.url, /\/api\/rd\/appointments\/7\/checkout$/);
  assert.deepEqual(got, order);
});

test("verifyAppointment: POSTs the signature payload to /:id/verify", async () => {
  const { impl, calls } = fakeFetch(() => jsonRes({ appointment: { ...APPT, paymentStatus: "paid" } }));
  const body = { razorpayPaymentId: "pay_1", razorpayOrderId: "order_x", razorpaySignature: "sig_1" };
  const appt = await verifyAppointment(7, body, impl);
  assert.match(calls[0]!.url, /\/api\/rd\/appointments\/7\/verify$/);
  assert.deepEqual(calls[0]!.body, body);
  assert.equal(appt.paymentStatus, "paid");
});

test("payForAppointment: checkout → adapter.open(order) → verify, in order", async () => {
  const order = { razorpayOrderId: "order_x", amount: 120000, currency: "INR", keyId: "key_x" };
  const { impl, calls } = fakeFetch((url) =>
    url.includes("/checkout") ? jsonRes(order) : jsonRes({ appointment: { ...APPT, paymentStatus: "paid" } }),
  );
  let seenOrder: unknown;
  const razorpay: RazorpayAdapter = {
    async open(o) {
      seenOrder = o;
      return { razorpayPaymentId: "pay_1", razorpayOrderId: o.razorpayOrderId, razorpaySignature: "sig_1" };
    },
  };
  const appt = await payForAppointment(7, razorpay, impl);
  // the adapter received the SERVER order (client authored nothing)
  assert.deepEqual(seenOrder, order);
  // verify was called with the adapter's payment result
  const verifyCall = calls.find((c) => c.url.includes("/verify"));
  assert.deepEqual(verifyCall!.body, { razorpayPaymentId: "pay_1", razorpayOrderId: "order_x", razorpaySignature: "sig_1" });
  assert.equal(appt.paymentStatus, "paid");
  // order: checkout before verify
  assert.ok(calls.findIndex((c) => c.url.includes("/checkout")) < calls.findIndex((c) => c.url.includes("/verify")));
});
