import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeE164,
  hashTrialPhone,
  trialCreditGrantFor,
} from "./trialEligibility.js";

test("normalizeE164 collapses equivalent Indian phone formats to one canonical form", () => {
  const canonical = "919812345678";
  assert.equal(normalizeE164("+91 98123 45678"), canonical);
  assert.equal(normalizeE164("098123 45678"), canonical);
  assert.equal(normalizeE164("9812345678"), canonical);
  assert.equal(normalizeE164("(+91)-98123-45678"), canonical);
});

test("normalizeE164 returns empty for unusable input", () => {
  assert.equal(normalizeE164(""), "");
  assert.equal(normalizeE164(null), "");
  assert.equal(normalizeE164("12345"), ""); // too few digits
});

test("hashTrialPhone is deterministic and format-insensitive (one phone → one hash)", () => {
  const a = hashTrialPhone("+91 98123 45678");
  const b = hashTrialPhone("09812345678");
  assert.equal(a, b, "equivalent formats hash identically");
  assert.match(a, /^[0-9a-f]{64}$/, "hex sha-256");
});

test("hashTrialPhone does not leak the raw number and differs across numbers", () => {
  const h = hashTrialPhone("9812345678");
  assert.ok(!h.includes("9812345678"));
  assert.notEqual(h, hashTrialPhone("9800000000"));
  assert.equal(hashTrialPhone("nonsense"), ""); // unusable → no hash
});

test("trial credit grant: ₹399 lot expiring 7 days after trial end", () => {
  const trialEnds = new Date("2026-08-01T00:00:00.000Z");
  const grant = trialCreditGrantFor(trialEnds);
  assert.equal(grant.deltaPaise, 39900);
  assert.equal(grant.reason, "trial_creditback");
  assert.equal(grant.expiresAt.toISOString(), "2026-08-08T00:00:00.000Z");
  // pure: does not mutate the input
  assert.equal(trialEnds.toISOString(), "2026-08-01T00:00:00.000Z");
});
