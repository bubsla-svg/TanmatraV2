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

test("non-ApiError degrades to generic copy without leaking the thrown message", () => {
  // Asserted by intent rather than by exact string: the wording was tightened
  // for Law 9 (it now answers "was I charged?"), and pinning the sentence
  // verbatim turned a copy improvement into a failing test. What must hold is
  // that the internal message never surfaces and the customer gets an action.
  const msg = humanizeOrderError(new Error("boom"));
  assert.ok(!msg.includes("boom"), `thrown message leaked: ${msg}`);
  assert.match(msg, /Try again in a moment\.$/);
});

test("deterministic 4xx refusals are not retryable; 5xx/429/network are", () => {
  assert.equal(isRetryableQuoteError(new ApiError(422, "safety_block", "Safety block")), false);
  assert.equal(isRetryableQuoteError(new ApiError(422, "dish_unavailable", "dish unavailable: X")), false);
  assert.equal(isRetryableQuoteError(new ApiError(403, "premium_required", "premium")), false);
  assert.equal(isRetryableQuoteError(new ApiError(503, "menu_unavailable", "menu unavailable, try again")), true);
  assert.equal(isRetryableQuoteError(new ApiError(429, "rate_limited", "too many requests")), true);
  assert.equal(isRetryableQuoteError(new TypeError("fetch failed")), true);
});

/**
 * Law 9 (end with what happens next) — the unmapped-code path.
 *
 * The module header describes "Safety block" reaching customers verbatim over a
 * Retry button that could never work. That case got a bespoke branch, but the
 * fallthrough kept returning `e.message` raw, so the same defect survived for
 * every code nobody had mapped yet: a machine string, and no next action.
 */

test("an unmapped code never returns a bare machine string", () => {
  const e = new ApiError(422, "quote_expired", "quote_expired");
  const msg = humanizeOrderError(e);
  assert.ok(!msg.includes("quote_expired"), `raw code leaked: ${msg}`);
  assert.match(msg, /couldn't price this order/);
});

test("an unmapped code still ends with a next action", () => {
  const e = new ApiError(500, "kitchen_offline", "Kitchen offline");
  assert.match(humanizeOrderError(e), /Try again in a moment\.$/);
});

test("the fallback next step agrees with the retry affordance", () => {
  // A deterministic 4xx offers no Retry button, so the copy must not say
  // "try again" beside a screen that cannot.
  const terminal = new ApiError(422, "invalid_customization", "Invalid customization");
  assert.equal(isRetryableQuoteError(terminal), false);
  assert.match(humanizeOrderError(terminal), /Adjust the items below to continue\.$/);

  const transient = new ApiError(503, "upstream_timeout", "Upstream timeout");
  assert.equal(isRetryableQuoteError(transient), true);
  assert.match(humanizeOrderError(transient), /Try again in a moment\.$/);
});

test("genuine server prose is preserved, with an action appended", () => {
  // Some routes do write customer copy; this must not flatten it to generic
  // text, or the fix would destroy information to satisfy a rule.
  const e = new ApiError(409, "slot_taken", "That delivery slot was just taken by someone else.");
  const msg = humanizeOrderError(e);
  assert.match(msg, /slot was just taken/);
  // A 409 is retryable by isRetryableQuoteError (not a listed terminal code,
  // <500, not 429), so the retry wording is the correct pairing here — the
  // point of this case is that the server's own sentence survives.
  assert.match(msg, /Try again in a moment\.$/);
});

test("a two-word internal label is treated as machine vocabulary", () => {
  // "Safety block." has sentence punctuation but is still a label, not a
  // sentence — length is what separates them.
  const e = new ApiError(422, "some_new_block", "Safety block.");
  assert.ok(!humanizeOrderError(e).startsWith("Safety block."));
});

test("a non-ApiError says the order was not placed", () => {
  // "Something went wrong" on a payment screen reads as "did I just get
  // charged?". The copy has to answer that.
  const msg = humanizeOrderError(new TypeError("fetch failed"));
  assert.match(msg, /was not placed/);
  assert.match(msg, /cart is safe/);
  assert.match(msg, /Try again in a moment\.$/);
});

test("every mapped branch ends with something the customer can do", () => {
  const cases: ApiError[] = [
    new ApiError(409, "dish_unavailable", "dish unavailable: Paneer Bowl"),
    new ApiError(422, "unserviceable_pincode", "unserviceable"),
    new ApiError(403, "premium_required", "premium required"),
    new ApiError(422, "safety_block", "Safety block", [{ code: "unchecked_allergens" }] as unknown as string[]),
    new ApiError(503, "alc_checkout_disabled", "disabled"),
    new ApiError(500, "unmapped_thing", "unmapped_thing"),
  ];
  // An imperative verb aimed at the reader — the shape Law 9 asks for.
  const ACTION = /\b(Remove|Change|Use|Adjust|Try|switch)\b/;
  for (const e of cases) {
    assert.match(humanizeOrderError(e), ACTION, `no next action for ${e.code}`);
  }
});
