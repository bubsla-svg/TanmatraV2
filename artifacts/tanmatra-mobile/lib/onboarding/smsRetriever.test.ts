/**
 * node --test --import tsx ./lib/onboarding/smsRetriever.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractOtpCode, startSmsRetriever } from "./smsRetriever";

test("extracts a 6-digit code from a typical OTP SMS", () => {
  assert.equal(
    extractOtpCode(
      "<#> Your Tanmatra verification code is 482915. FA+9qK71234",
    ),
    "482915",
  );
});

test("returns null when there is no 6-digit code", () => {
  assert.equal(extractOtpCode("Welcome to Tanmatra!"), null);
  assert.equal(extractOtpCode(""), null);
  assert.equal(extractOtpCode(null), null);
  // A 5-digit run is not a valid code.
  assert.equal(extractOtpCode("code 12345"), null);
});

test("startSmsRetriever returns a callable unsubscribe (no-op seam)", () => {
  const unsub = startSmsRetriever({ onCode: () => {} });
  assert.equal(typeof unsub, "function");
  unsub(); // must not throw
});
