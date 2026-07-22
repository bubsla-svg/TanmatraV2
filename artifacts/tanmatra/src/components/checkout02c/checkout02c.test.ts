// Pure-model tests for the Breeze checkout. DB-free; run via the api-server tsx
// loader:
//   cd artifacts/api-server && node --test --import tsx \
//     ../tanmatra/src/components/checkout02c/checkout02c.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_SCREENS,
  CHECKOUT_LOAD_BUDGET,
  HAS_COUPON_FIELD,
  OFFERS_COD,
  screensForUser,
  typedFieldCount,
} from "./checkout02c.js";

test("checkout is exactly Identity → Address → Pay, one decision each", () => {
  assert.deepEqual(
    CHECKOUT_SCREENS.map((s) => s.id),
    ["identity", "address", "pay"],
  );
  // one decision per screen is expressed as a single decision string each
  for (const s of CHECKOUT_SCREENS) {
    assert.ok(s.decision.length > 0);
  }
});

test("no coupon field and no COD — structurally absent (02c §2/§6)", () => {
  assert.equal(HAS_COUPON_FIELD, false);
  assert.equal(OFFERS_COD, false);
});

test("screen list adapts to the user; pay is always last", () => {
  // brand-new user walks all three
  assert.deepEqual(screensForUser({ signedIn: false, hasSavedAddress: false }), [
    "identity",
    "address",
    "pay",
  ]);
  // returning user with a saved address → tap-only, straight to pay
  assert.deepEqual(screensForUser({ signedIn: true, hasSavedAddress: true }), ["pay"]);
  // signed-in, no saved address
  assert.deepEqual(screensForUser({ signedIn: true, hasSavedAddress: false }), [
    "address",
    "pay",
  ]);
});

test("typed-field ceilings respect the load budget (02c §4)", () => {
  const newUser = typedFieldCount({ signedIn: false, hasSavedAddress: false });
  assert.ok(
    newUser <= CHECKOUT_LOAD_BUDGET.typedFieldsNewMax,
    `new user typed fields ${newUser} exceeds budget`,
  );
  const returning = typedFieldCount({ signedIn: true, hasSavedAddress: true });
  assert.equal(returning, CHECKOUT_LOAD_BUDGET.typedFieldsReturningMax); // 0 — tap-only
});

test("returning-user screen count is within budget", () => {
  const returning = screensForUser({ signedIn: true, hasSavedAddress: true }).length;
  assert.ok(returning <= CHECKOUT_LOAD_BUDGET.screensReturningMax);
});
