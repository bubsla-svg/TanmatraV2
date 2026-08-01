import test from "node:test";
import assert from "node:assert/strict";
import {
  RESEND_COOLDOWN_SEC,
  canResend,
  isCodeValid,
  isPhoneValid,
  resendSecondsLeft,
  OTP_MESSAGES,
} from "./otpFlow";

test("phone validity ignores formatting and requires 10 digits", () => {
  assert.equal(isPhoneValid("98765 43210"), true);
  assert.equal(isPhoneValid("98765-43210"), true);
  assert.equal(isPhoneValid("9876543210"), true);
  assert.equal(isPhoneValid("98765"), false);
  assert.equal(isPhoneValid(""), false);
});

test("code must be exactly 6 digits — not merely at least 6", () => {
  assert.equal(isCodeValid("123456"), true);
  assert.equal(isCodeValid("12345"), false);
  // The old `>= 6` check let a 7-digit paste through to Firebase, which
  // rejected it with an opaque error instead of the field saying so.
  assert.equal(isCodeValid("1234567"), false);
});

test("no send yet means no cooldown", () => {
  assert.equal(resendSecondsLeft(null, 1_000_000), 0);
  assert.equal(canResend(null, 1_000_000), true);
});

test("cooldown counts down and then unlocks", () => {
  const sentAt = 1_000_000;
  assert.equal(resendSecondsLeft(sentAt, sentAt), RESEND_COOLDOWN_SEC);
  assert.equal(resendSecondsLeft(sentAt, sentAt + 10_000), RESEND_COOLDOWN_SEC - 10);
  assert.equal(canResend(sentAt, sentAt + 10_000), false);

  assert.equal(resendSecondsLeft(sentAt, sentAt + RESEND_COOLDOWN_SEC * 1000), 0);
  assert.equal(canResend(sentAt, sentAt + RESEND_COOLDOWN_SEC * 1000), true);
});

test("cooldown never goes negative once the window has passed", () => {
  const sentAt = 1_000_000;
  assert.equal(resendSecondsLeft(sentAt, sentAt + 999_999), 0);
});

test("clock skew (a future timestamp) yields a full window, never a negative", () => {
  const sentAt = 1_000_000;
  const left = resendSecondsLeft(sentAt, sentAt - 5_000);
  assert.equal(left, RESEND_COOLDOWN_SEC);
  assert.ok(left >= 0);
});

test("every failure mode has user-facing copy — no silent no-ops", () => {
  for (const message of Object.values(OTP_MESSAGES)) {
    assert.ok(message.length > 0);
  }
});
