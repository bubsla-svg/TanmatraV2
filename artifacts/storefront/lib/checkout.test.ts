// 02c Breeze checkout invariants. Run with the api-server tsx loader:
//   cd artifacts/api-server && \
//   node --test --import tsx ../storefront/lib/checkout.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  screensForUser,
  typedFieldBudget,
  EVICTED_DECISIONS,
  FORBIDDEN_ELEMENTS,
  BUDGET,
} from "./checkout";

test("new user sees exactly 3 screens: identity → address → pay", () => {
  assert.deepEqual(screensForUser({ signedIn: false, hasSavedAddress: false }), [
    "identity",
    "address",
    "pay",
  ]);
});

test("returning user with a saved address is tap-only (pay only, 0 typed fields)", () => {
  const u = { signedIn: true, hasSavedAddress: true };
  assert.deepEqual(screensForUser(u), ["pay"]);
  assert.equal(typedFieldBudget(u), 0);
});

test("signed-in without a saved address skips identity (address → pay)", () => {
  assert.deepEqual(screensForUser({ signedIn: true, hasSavedAddress: false }), [
    "address",
    "pay",
  ]);
});

test("screen counts stay within the 02c load budget", () => {
  const newMax = screensForUser({ signedIn: false, hasSavedAddress: false }).length;
  const returningMax = screensForUser({ signedIn: true, hasSavedAddress: false }).length;
  assert.ok(newMax <= BUDGET.screensNewMax, "new user within screen budget");
  assert.ok(returningMax <= BUDGET.screensReturningMax, "returning within screen budget");
});

test("coupon and COD are evicted decisions — they do not exist in checkout", () => {
  assert.ok(EVICTED_DECISIONS.includes("coupon"));
  assert.ok(EVICTED_DECISIONS.includes("cod"));
});

test("the forbidden-element set names the surfaces the UI must never render", () => {
  for (const el of ["coupon_field", "cod_option", "slot_picker"]) {
    assert.ok(FORBIDDEN_ELEMENTS.includes(el as (typeof FORBIDDEN_ELEMENTS)[number]));
  }
});
