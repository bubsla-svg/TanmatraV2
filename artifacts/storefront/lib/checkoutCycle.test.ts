import assert from "node:assert/strict";
import test from "node:test";
import { asBuilderCycle, BUILDER_CYCLES } from "./checkoutCycle";

// Regression test for the bug the pricing-invariant sweep found: PlanBuilder
// confirms a cycle (Weekly ₹1,199, Monthly ₹4,378, Quarterly …) and pushes it
// to /checkout?cycle=weekly, but the checkout page used to drop the param on
// the floor and quote+bill every plan as monthly — a 3.65x overcharge for a
// Weekly pick. asBuilderCycle is the one gate between that query string and
// what PlanCheckout bills; this file locks its contract down.

test("every cycle the builder can actually emit round-trips", () => {
  for (const cycle of BUILDER_CYCLES) {
    assert.equal(asBuilderCycle(cycle), cycle);
  }
});

test("an absent cycle resolves to undefined, not a guessed cadence", () => {
  assert.equal(asBuilderCycle(undefined), undefined);
});

test("an unrecognised or injected value is rejected, not passed through", () => {
  assert.equal(asBuilderCycle(""), undefined);
  assert.equal(asBuilderCycle("fortnightly"), undefined); // valid PlanCadence, but the builder never offers it
  assert.equal(asBuilderCycle("one_off"), undefined); // valid PlanCycle, but the builder never offers it
  assert.equal(asBuilderCycle("MONTHLY"), undefined); // case-sensitive — no silent normalisation
  assert.equal(asBuilderCycle("weekly; DROP TABLE subscriptions"), undefined);
});

test("BUILDER_CYCLES is exactly the three cadences PlanBuilder's UI offers", () => {
  // If this ever drifts from PlanBuilder.tsx's cycle-selector, quotes for a
  // fourth cycle would render there with nothing at /checkout able to accept
  // it — pin the exact set so an edit to either side is a visible diff here.
  assert.deepEqual([...BUILDER_CYCLES].sort(), ["monthly", "quarterly", "weekly"]);
});
