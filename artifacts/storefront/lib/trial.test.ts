// 3-Day Taste Test invariants (02b / 02e §6). Run with the api-server tsx loader:
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/trial.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { WEEKLY_PRICE_PAISE } from "@workspace/subscription-rules";
import {
  TRIAL_TRIO,
  TRIAL_PRICE_PAISE,
  TRIAL_CREDITBACK_PAISE,
  planTotalAfterCredit,
  trialPlusWeeklyPaise,
} from "./trial";

test("trial is ₹399 and the creditback is the full ₹399", () => {
  assert.equal(TRIAL_PRICE_PAISE, 39900);
  assert.equal(TRIAL_CREDITBACK_PAISE, 39900);
});

test("02e §6 exact: trial + the credited first week = the weekly price (₹1,199)", () => {
  // ₹399 paid now + (₹1,199 − ₹399) charged at plan start = ₹1,199 total.
  assert.equal(planTotalAfterCredit(WEEKLY_PRICE_PAISE), 80000);
  assert.equal(trialPlusWeeklyPaise(), WEEKLY_PRICE_PAISE);
  assert.equal(trialPlusWeeklyPaise(), 119900);
});

test("the credit never over-applies — a plan cheaper than the credit clamps to 0", () => {
  assert.equal(planTotalAfterCredit(TRIAL_CREDITBACK_PAISE - 100), 0);
});

test("the fixed trio is exactly 3 dishes per track, no swaps", () => {
  assert.equal(TRIAL_TRIO.veg.length, 3);
  assert.equal(TRIAL_TRIO.nonveg.length, 3);
  // veg and nonveg trios are distinct sets.
  assert.notDeepEqual(TRIAL_TRIO.veg, TRIAL_TRIO.nonveg);
});
