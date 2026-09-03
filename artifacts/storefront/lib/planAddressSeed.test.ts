/**
 * The plan checkout's address seeding (no render, no network): the gate's PIN
 * seed fills only the PIN, a saved address that lands afterwards seeds the
 * form once, and nothing ever overwrites what the customer typed.
 * Run: node --test --import tsx ./lib/planAddressSeed.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isCompleteAddress, seedPlanAddress } from "./planAddressSeed";

const EMPTY = { line1: "", city: "", pincode: "" };
const SEED = { line1: "", city: "", pincode: "201301" };
const SAVED = { line1: "Flat 3B, Sector 62", city: "Noida", pincode: "201301" };
const UNTOUCHED = { touched: false, prefilled: false };

test("the gate's PIN seed fills only the PIN and does not use up the prefill", () => {
  const r = seedPlanAddress(EMPTY, SEED, UNTOUCHED);
  assert.deepEqual(r.next, { line1: "", city: "", pincode: "201301" });
  assert.equal(r.prefilled, false);
});

test("a saved address that lands after the seed seeds the form once", () => {
  const seeded = seedPlanAddress(EMPTY, SEED, UNTOUCHED);
  const r = seedPlanAddress(seeded.next, SAVED, { touched: false, prefilled: seeded.prefilled });
  assert.deepEqual(r.next, SAVED);
  assert.equal(r.prefilled, true);
});

test("the saved address wins over the seed's PIN, being the more complete answer", () => {
  const seeded = seedPlanAddress(EMPTY, { ...SEED, pincode: "110001" }, UNTOUCHED);
  const r = seedPlanAddress(seeded.next, SAVED, { touched: false, prefilled: seeded.prefilled });
  assert.equal(r.next.pincode, "201301");
});

test("typing before the saved address lands means it never clobbers the fields", () => {
  const typed = { line1: "Tower 4, Sec 137", city: "", pincode: "201301" };
  const r = seedPlanAddress(typed, SAVED, { touched: true, prefilled: false });
  assert.deepEqual(r.next, typed);
  assert.equal(r.prefilled, false);
});

test("type-then-clear is still the customer's choice — a later address does not refill it", () => {
  const cleared = { line1: "", city: "", pincode: "201301" };
  const r = seedPlanAddress(cleared, SAVED, { touched: true, prefilled: false });
  assert.deepEqual(r.next, cleared);
});

test("a second complete address after the prefill leaves the form alone", () => {
  const other = { line1: "Villa 9, Sector 50", city: "Noida", pincode: "201301" };
  const r = seedPlanAddress(SAVED, other, { touched: false, prefilled: true });
  assert.deepEqual(r.next, SAVED);
  assert.equal(r.prefilled, true);
});

test("a bare seed re-applied on later renders is a no-op once the form is filled", () => {
  const r = seedPlanAddress(SAVED, SEED, { touched: false, prefilled: true });
  assert.deepEqual(r.next, SAVED);
  assert.equal(r.prefilled, true);
});

test("no incoming address changes nothing", () => {
  assert.deepEqual(seedPlanAddress(SAVED, null, { touched: false, prefilled: true }).next, SAVED);
  assert.deepEqual(seedPlanAddress(EMPTY, undefined, UNTOUCHED), { next: EMPTY, prefilled: false });
});

test("completeness is a street line, not a PIN", () => {
  assert.equal(isCompleteAddress(SEED), false);
  assert.equal(isCompleteAddress({ line1: "   ", city: "Noida", pincode: "201301" }), false);
  assert.equal(isCompleteAddress(SAVED), true);
  assert.equal(isCompleteAddress(null), false);
});
