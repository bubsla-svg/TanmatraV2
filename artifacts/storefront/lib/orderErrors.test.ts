/**
 * Regression tests for the checkout error copy (2026-08-11 customer report):
 * production rendered the literal server string "Safety block" above a
 * "Retry pricing" button that could never succeed, because the 422
 * `safety_block` body had no humanized case and no retryability distinction.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "./apiClient";
import { humanizeOrderError, isRetryableQuoteError } from "./orderErrors";

test("safety_block with the production unchecked_allergens reason gets real copy", () => {
  const e = new ApiError(422, "safety_block", "Safety block", [
    { code: "unchecked_allergens" },
  ] as unknown as string[]);
  const msg = humanizeOrderError(e);
  assert.ok(!msg.includes("Safety block"), `raw server string leaked: ${msg}`);
  assert.match(msg, /allergen information hasn't been verified/);
  assert.match(msg, /Remove the affected dish/);
});

test("safety_block with string reasons (subscription-style body) passes them through", () => {
  const e = new ApiError(422, "safety_block", "Safety block", [
    "Contains peanuts — allergen on file",
  ]);
  assert.match(humanizeOrderError(e), /Contains peanuts — allergen on file/);
});

test("safety_block with allergen_block objects names the allergens", () => {
  const e = new ApiError(422, "safety_block", "Safety block", [
    { code: "allergen_block", allergens: ["peanut", "soy"] },
  ] as unknown as string[]);
  assert.match(humanizeOrderError(e), /peanut, soy/);
});

test("safety_block with no reasons still never shows the raw string", () => {
  const e = new ApiError(422, "safety_block", "Safety block");
  const msg = humanizeOrderError(e);
  assert.ok(!msg.includes("Safety block"));
  assert.match(msg, /dietary-safety check/);
});

test("dish_unavailable keeps the kitchen-paused copy with the dish name", () => {
  const e = new ApiError(422, "dish_unavailable", "dish unavailable: Avocado Toast");
  assert.match(humanizeOrderError(e), /Avocado Toast isn't available right now/);
});

test("non-ApiError degrades to the generic retry copy", () => {
  assert.equal(humanizeOrderError(new Error("boom")), "Something went wrong. Please try again.");
});

test("deterministic 4xx refusals are not retryable; 5xx/429/network are", () => {
  assert.equal(isRetryableQuoteError(new ApiError(422, "safety_block", "Safety block")), false);
  assert.equal(isRetryableQuoteError(new ApiError(422, "dish_unavailable", "dish unavailable: X")), false);
  assert.equal(isRetryableQuoteError(new ApiError(403, "premium_required", "premium")), false);
  assert.equal(isRetryableQuoteError(new ApiError(503, "menu_unavailable", "menu unavailable, try again")), true);
  assert.equal(isRetryableQuoteError(new ApiError(429, "rate_limited", "too many requests")), true);
  assert.equal(isRetryableQuoteError(new TypeError("fetch failed")), true);
});
