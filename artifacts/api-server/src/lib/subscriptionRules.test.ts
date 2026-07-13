// Unit tests for the pure subscription cutoff rule (no DB).
// Run: node --test --import tsx ./src/lib/subscriptionRules.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { SKIP_SWAP_CUTOFF_MS, isPastSkipCutoff } from "./subscriptionRules.js";

const NOW = 1_000_000_000_000; // fixed reference "now"

test("delivery more than 24h away is NOT past cutoff", () => {
  assert.equal(isPastSkipCutoff(NOW + SKIP_SWAP_CUTOFF_MS + 60_000, NOW), false);
});

test("delivery exactly 24h away is NOT past cutoff (boundary)", () => {
  assert.equal(isPastSkipCutoff(NOW + SKIP_SWAP_CUTOFF_MS, NOW), false);
});

test("delivery just inside 24h IS past cutoff", () => {
  assert.equal(isPastSkipCutoff(NOW + SKIP_SWAP_CUTOFF_MS - 60_000, NOW), true);
});

test("delivery 1 minute away IS past cutoff (the T-1min edge)", () => {
  assert.equal(isPastSkipCutoff(NOW + 60_000, NOW), true);
});

test("delivery in the past IS past cutoff", () => {
  assert.equal(isPastSkipCutoff(NOW - 60_000, NOW), true);
});

test("accepts Date and ISO string inputs", () => {
  assert.equal(isPastSkipCutoff(new Date(NOW + 60_000), NOW), true);
  assert.equal(isPastSkipCutoff(new Date(NOW + SKIP_SWAP_CUTOFF_MS + 60_000).toISOString(), NOW), false);
});

test("invalid date does not block (returns false)", () => {
  assert.equal(isPastSkipCutoff("not-a-date", NOW), false);
});
