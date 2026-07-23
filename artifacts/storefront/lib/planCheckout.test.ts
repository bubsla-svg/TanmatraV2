/**
 * SF-07 — the plan money-path assembly invariants (no render, no network):
 * the create body threads the members, flattens the address, and carries NO
 * client-authored price/amount (the server bills from planId); the delivery
 * start never lands on a weekend.
 * Run: node --test --import tsx ./lib/planCheckout.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildSubscriptionInput, nextWeekdayISO, PLAN_DELIVERY_WINDOW } from "./planCheckout";
import type { MemberInput } from "./api";

const MEMBERS: MemberInput[] = [
  { name: "Asha", diet: "veg", allergens: ["peanut"], medicalConditions: ["t2dm"], spiceLevel: "mild" },
];

test("buildSubscriptionInput: members threaded, address flattened, NO price authored", () => {
  const body = buildSubscriptionInput({
    planId: "steady",
    track: "veg",
    cadence: "monthly",
    mealsPerDelivery: 5,
    startDate: "2026-07-27",
    members: MEMBERS,
    address: { line1: "Tower 4", line2: "Sector 62", city: "Noida", pincode: "201301" },
    phone: "+919999999999",
  });
  assert.equal(body.planId, "steady");
  assert.equal(body.track, "veg");
  assert.equal(body.cadence, "monthly");
  assert.equal(body.mealsPerDelivery, 5);
  assert.equal(body.deliveryWindow, PLAN_DELIVERY_WINDOW);
  assert.deepEqual(body.members, MEMBERS);
  assert.equal(body.addressLine, "Tower 4, Sector 62");
  assert.equal(body.city, "Noida");
  assert.equal(body.pincode, "201301");
  assert.equal(body.phone, "+919999999999");
  // §4.3: the client must never send a price/amount — the server bills the plan.
  assert.ok(!("totalPaise" in body), "no totalPaise");
  assert.ok(!("amountPaise" in body), "no amountPaise");
  assert.ok(!("pricePaise" in body), "no pricePaise");
});

test("addOns thread through to the create body; empty/absent is OMITTED", () => {
  const base = {
    planId: "desk_fuel", track: "veg" as const, cadence: "monthly" as const,
    mealsPerDelivery: 5, startDate: "2026-07-27", members: MEMBERS,
    address: { line1: "Flat 3B", city: "Noida", pincode: "201301" }, phone: "+911",
  };
  const withBump = buildSubscriptionInput({ ...base, addOns: ["rd_bump"] });
  assert.deepEqual(withBump.addOns, ["rd_bump"]);
  // Still no client-authored amount — the server prices the bump too.
  assert.ok(!("totalPaise" in withBump), "no totalPaise with addOns");
  const without = buildSubscriptionInput(base);
  assert.ok(!("addOns" in without), "absent addOns omitted");
  const empty = buildSubscriptionInput({ ...base, addOns: [] });
  assert.ok(!("addOns" in empty), "empty addOns omitted");
});

test("addressLine omits an empty line2", () => {
  const body = buildSubscriptionInput({
    planId: "desk_fuel", track: "veg", cadence: "monthly", mealsPerDelivery: 5,
    startDate: "2026-07-27", members: MEMBERS,
    address: { line1: "Flat 3B", city: "Noida", pincode: "201301" }, phone: "+911",
  });
  assert.equal(body.addressLine, "Flat 3B");
});

test("nextWeekdayISO: Friday → Monday, weekday → next day, never a weekend", () => {
  // 2026-07-24 is a Friday → +1 = Sat → skip to Mon 2026-07-27.
  assert.equal(nextWeekdayISO(new Date("2026-07-24T09:00:00Z")), "2026-07-27");
  // 2026-07-27 is a Monday → +1 = Tue 2026-07-28.
  assert.equal(nextWeekdayISO(new Date("2026-07-27T09:00:00Z")), "2026-07-28");
  // 2026-07-25 is a Saturday → +1 = Sun → skip to Mon 2026-07-27.
  assert.equal(nextWeekdayISO(new Date("2026-07-25T09:00:00Z")), "2026-07-27");
});
