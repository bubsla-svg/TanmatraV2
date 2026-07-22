/**
 * node --test --import tsx ./lib/onboarding/otpTimer.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  startResend,
  tickResend,
  canResend,
  RESEND_COOLDOWN_SECONDS,
} from "./otpTimer";

test("starts at the cooldown and cannot resend yet", () => {
  const s = startResend();
  assert.equal(s.secondsLeft, RESEND_COOLDOWN_SECONDS);
  assert.equal(canResend(s), false);
});

test("ticks down to zero, then allows resend and clamps at zero", () => {
  let s = startResend(3);
  s = tickResend(s);
  s = tickResend(s);
  assert.equal(s.secondsLeft, 1);
  assert.equal(canResend(s), false);
  s = tickResend(s);
  assert.equal(s.secondsLeft, 0);
  assert.equal(canResend(s), true);
  s = tickResend(s); // clamp
  assert.equal(s.secondsLeft, 0);
});

test("tickResend returns a new object (immutable)", () => {
  const s = startResend(2);
  const next = tickResend(s);
  assert.notEqual(s, next);
  assert.equal(s.secondsLeft, 2);
});
