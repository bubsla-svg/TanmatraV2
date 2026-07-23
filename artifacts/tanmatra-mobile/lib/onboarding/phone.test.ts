/**
 * node --test --import tsx ./lib/onboarding/phone.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePhone, isCompleteOtp, maskPhone } from "./phone";

test("parses a valid +91 mobile number", () => {
  const p = parsePhone("98765 43210");
  assert.deepEqual(p, {
    countryCode: "+91",
    phone: "9876543210",
    e164: "+919876543210",
  });
});

test("rejects a +91 number that is not 10 digits starting 6-9", () => {
  assert.equal(parsePhone("12345"), null);
  assert.equal(parsePhone("1234567890"), null); // starts with 1
  assert.equal(parsePhone("987654321"), null); // 9 digits
});

test("accepts a non-India number within generic bounds", () => {
  const p = parsePhone("2025550123", "+1");
  assert.equal(p?.e164, "+12025550123");
});

test("isCompleteOtp requires exactly 6 digits", () => {
  assert.equal(isCompleteOtp("123456"), true);
  assert.equal(isCompleteOtp("12345"), false);
  assert.equal(isCompleteOtp("1234567"), false);
  assert.equal(isCompleteOtp("12a456"), false);
});

test("maskPhone keeps the code and last two digits", () => {
  // "+91" + space + 8 masked digits + "10"
  assert.equal(
    maskPhone({ countryCode: "+91", phone: "9876543210" }),
    `+91 ${"•".repeat(8)}10`,
  );
});
