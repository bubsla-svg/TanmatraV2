import test from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_KEY_ALLOWLIST,
  sanitizeAnalyticsEvent,
  capturePostHogEvent,
} from "./analyticsSanitizer";

test("sanitizeAnalyticsEvent strips clinical and PII fields, keeps allowlisted ones", () => {
  const dangerousClientPayload = {
    event_name: "checkout_step_viewed",
    route: "/checkout",
    timestamp: 1_700_000_000_000,
    clinical_condition: "PCOS / Insulin Resistance", // SENSITIVE: MUST STRIP
    allergens: ["peanuts", "shellfish"], // SENSITIVE: MUST STRIP
    glucose_reading: 142, // SENSITIVE: MUST STRIP
    employee_id: "EMP-90210", // SENSITIVE: MUST STRIP
  };

  const sanitized = sanitizeAnalyticsEvent(dangerousClientPayload);

  assert.equal(sanitized["clinical_condition"], undefined);
  assert.equal(sanitized["allergens"], undefined);
  assert.equal(sanitized["glucose_reading"], undefined);
  assert.equal(sanitized["employee_id"], undefined);
  assert.equal(sanitized["event_name"], "checkout_step_viewed");
  assert.equal(sanitized["route"], "/checkout");
  assert.equal(sanitized["timestamp"], 1_700_000_000_000);
});

test("sanitizeAnalyticsEvent passes through every allowlisted key", () => {
  const full = {
    event_name: "e",
    route: "/r",
    timestamp: 1,
    device_type: "mobile",
    plan_id: "plan_x",
    cart_item_count: 3,
    checkout_step: "pay",
    payment_provider: "razorpay",
    customer_state: "returning",
    auth_state: "authed",
    intent: "plan_upgrade",
    viewport_bucket: "sm",
    payment_method: "upi",
    failure_reason: "gateway_timeout",
  };
  assert.deepEqual(sanitizeAnalyticsEvent(full), full);
});

test("PR-11i realignment: the six new funnel dimensions pass, but PII never rides alongside them", () => {
  const payload = {
    event_name: "begin_checkout",
    // the six realignment dimensions — enums / machine codes, allowed
    customer_state: "lapsed",
    auth_state: "anon",
    intent: "trial_start",
    viewport_bucket: "xs",
    payment_method: "card",
    failure_reason: "insufficient_funds",
    // PII that must still be stripped even now that the list is wider
    phone: "+919876543210",
    pincode: "560001",
    address: "12 MG Road, Bengaluru",
  };
  // deepEqual to exactly the seven allowed keys is the whole assertion: it proves
  // the six dimensions survive AND that phone/pincode/address did not ride along.
  assert.deepEqual(sanitizeAnalyticsEvent(payload), {
    event_name: "begin_checkout",
    customer_state: "lapsed",
    auth_state: "anon",
    intent: "trial_start",
    viewport_bucket: "xs",
    payment_method: "card",
    failure_reason: "insufficient_funds",
  });
});

test("sanitizeAnalyticsEvent on an empty payload returns an empty object, not a throw", () => {
  assert.deepEqual(sanitizeAnalyticsEvent({}), {});
});

test("the allowlist is exactly the fourteen documented keys — an unreviewed addition should fail this test", () => {
  assert.deepEqual(
    [...ANALYTICS_KEY_ALLOWLIST].sort(),
    [
      // base eight
      "cart_item_count",
      "checkout_step",
      "device_type",
      "event_name",
      "payment_provider",
      "plan_id",
      "route",
      "timestamp",
      // PR-11i analytics realignment — six funnel dimensions (enums / machine codes)
      "auth_state",
      "customer_state",
      "failure_reason",
      "intent",
      "payment_method",
      "viewport_bucket",
    ].sort(),
  );
});

test("capturePostHogEvent sanitizes before handing properties to the injected capture fn", () => {
  const calls: [string, Record<string, unknown> | undefined][] = [];
  const spyCapture = (event: string, properties?: Record<string, unknown>) => {
    calls.push([event, properties]);
  };

  capturePostHogEvent(spyCapture, "checkout_step_viewed", {
    checkout_step: "pay",
    glucose_reading: 142, // SENSITIVE: must never reach the spy
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.[0], "checkout_step_viewed");
  assert.deepEqual(calls[0]?.[1], { checkout_step: "pay" });
});

test("capturePostHogEvent defaults to an empty properties object", () => {
  const calls: [string, Record<string, unknown> | undefined][] = [];
  capturePostHogEvent((event, properties) => calls.push([event, properties]), "$pageview");
  assert.deepEqual(calls[0]?.[1], {});
});
