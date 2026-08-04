/**
 * The verify-step retry — the one retry on the money path that runs AFTER
 * Razorpay has captured the money. Pure fakes, no network.
 * Run: node --test --import tsx ./lib/moneyPath.verifyRetry.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyWithRetry,
  isRetryableVerifyError,
  finishAlacartePayment,
  VERIFY_ATTEMPTS,
  type RazorpayAdapter,
} from "./moneyPath";
import { ApiError } from "./apiClient";
import type { verifyPayment } from "./api";

type VerifyInput = Parameters<typeof verifyPayment>[0];
type VerifyResult = Awaited<ReturnType<typeof verifyPayment>>;

const INPUT: VerifyInput = {
  orderId: "alc-1",
  razorpayPaymentId: "pay_1",
  razorpayOrderId: "rzp_1",
  razorpaySignature: "sig_1",
};
const OK: VerifyResult = { ok: true, orderId: "alc-1", status: "preparing" };
const noSleep = () => Promise.resolve();

test("retryable: network-level failures and 5xx; NOT 4xx verdicts", () => {
  assert.equal(isRetryableVerifyError(new TypeError("fetch failed")), true);
  assert.equal(isRetryableVerifyError(new ApiError(502, "bad_gateway", "upstream died")), true);
  assert.equal(isRetryableVerifyError(new ApiError(503, "unavailable", "…")), true);
  // A 4xx is a VERDICT — an invalid signature does not become valid by asking again.
  assert.equal(isRetryableVerifyError(new ApiError(400, "invalid_signature", "…")), false);
  assert.equal(isRetryableVerifyError(new ApiError(409, "not_payable", "…")), false);
});

test("a network drop after capture is retried in place and succeeds", async () => {
  let calls = 0;
  const flaky = ((input: VerifyInput) => {
    calls++;
    assert.deepEqual(input, INPUT); // the SAME ids every attempt — nothing regenerated
    if (calls < 3) return Promise.reject(new TypeError("network dropped"));
    return Promise.resolve(OK);
  }) as typeof verifyPayment;

  const result = await verifyWithRetry(flaky, INPUT, noSleep);
  assert.equal(calls, 3);
  assert.deepEqual(result, OK);
});

test("gives up after VERIFY_ATTEMPTS and surfaces the last error", async () => {
  let calls = 0;
  const dead = (() => {
    calls++;
    return Promise.reject(new ApiError(502, "bad_gateway", "still down"));
  }) as typeof verifyPayment;

  await assert.rejects(verifyWithRetry(dead, INPUT, noSleep), (e) => {
    return e instanceof ApiError && e.status === 502;
  });
  assert.equal(calls, VERIFY_ATTEMPTS);
});

test("a 4xx verdict is NEVER retried — one call, immediate surface", async () => {
  let calls = 0;
  const verdict = (() => {
    calls++;
    return Promise.reject(new ApiError(400, "invalid_signature", "invalid payment signature"));
  }) as typeof verifyPayment;

  await assert.rejects(verifyWithRetry(verdict, INPUT, noSleep), (e) => {
    return e instanceof ApiError && e.status === 400;
  });
  assert.equal(calls, 1, "a signature verdict must not be re-asked");
});

test("finishAlacartePayment: verify retries in place — createRazorpayOrder is NOT re-run, modal NOT reopened", async () => {
  // The component-level retry used to re-run the whole payment leg, reopening
  // the pay modal at a customer whose money was already captured. The in-place
  // verify retry must keep the earlier steps at exactly one invocation.
  let createCalls = 0;
  let openCalls = 0;
  let verifyCalls = 0;
  let verifyingFired = 0;

  const adapter: RazorpayAdapter = {
    open: () => {
      openCalls++;
      return Promise.resolve({
        razorpayPaymentId: "pay_1",
        razorpayOrderId: "rzp_1",
        razorpaySignature: "sig_1",
      });
    },
  };

  const result = await finishAlacartePayment(
    { orderId: "alc-1", totalPaise: 41800, etaMinutes: 40 },
    adapter,
    {
      createRazorpayOrder: (() => {
        createCalls++;
        return Promise.resolve({ razorpayOrderId: "rzp_1", amount: 41800, currency: "INR", keyId: "key_x" });
      }) as never,
      verifyPayment: ((input: VerifyInput) => {
        verifyCalls++;
        assert.equal(input.orderId, "alc-1");
        if (verifyCalls === 1) return Promise.reject(new TypeError("network dropped mid-verify"));
        return Promise.resolve(OK);
      }) as typeof verifyPayment,
    },
    { onVerifying: () => verifyingFired++ },
  );

  assert.equal(createCalls, 1, "the Razorpay order must not be recreated");
  assert.equal(openCalls, 1, "the modal must not reopen at a customer who already paid");
  assert.equal(verifyCalls, 2, "verify retried in place");
  assert.equal(verifyingFired, 1, "the confirming state fired once, at capture");
  assert.equal(result.orderId, "alc-1");
  assert.equal(result.status, "preparing");
});
