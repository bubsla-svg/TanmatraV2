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
  };
  assert.deepEqual(sanitizeAnalyticsEvent(full), full);
});

test("sanitizeAnalyticsEvent on an empty payload returns an empty object, not a throw", () => {
  assert.deepEqual(sanitizeAnalyticsEvent({}), {});
});

test("the allowlist is exactly the eight documented keys — an unreviewed addition should fail this test", () => {
  assert.deepEqual(
    [...ANALYTICS_KEY_ALLOWLIST].sort(),
    [
      "cart_item_count",
      "checkout_step",
      "device_type",
      "event_name",
      "payment_provider",
      "plan_id",
      "route",
      "timestamp",
    ],
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
