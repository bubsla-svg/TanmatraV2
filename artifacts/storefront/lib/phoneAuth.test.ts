/**
 * Unit tests for phoneAuth E164 formatting and attribute contract (OB-5 / II.5).
 *
 * Run: node --test --import tsx ./lib/phoneAuth.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { toE164 } from "./phoneAuth";

test("toE164 strips non-digits and composes canonical country code syntax", () => {
  assert.equal(toE164("91", "9876543210"), "+919876543210");
  assert.equal(toE164("+91 ", " 98765 43210 "), "+919876543210");
  assert.equal(toE164("1", "(415) 555-0123"), "+14155550123");
});
