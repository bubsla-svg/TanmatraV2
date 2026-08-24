/**
 * SF-07 — the plan money-path assembly invariants (no render, no network):
 * the create body threads the members, flattens the address, and carries NO
 * client-authored price/amount (the server bills from planId); the delivery
 * start never lands on a weekend.
 * Run: node --test --import tsx ./lib/planCheckout.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubscriptionInput, nextWeekdayISO, PLAN_DELIVERY_WINDOW, PLAN_DELIVERY_DAYS_LABEL, PLAN_DELIVERY_DAYS_SENTENCE } from "./planCheckout";

const HERE = path.dirname(fileURLToPath(import.meta.url));
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

test("buildSubscriptionInput: threads ref parameter when provided (L-7)", () => {
  const base = {
    planId: "desk_fuel", track: "veg" as const, cadence: "monthly" as const,
    mealsPerDelivery: 5, startDate: "2026-07-27", members: MEMBERS,
    address: { line1: "Flat 3B", city: "Noida", pincode: "201301" }, phone: "+911",
  };
  const withRef = buildSubscriptionInput({ ...base, ref: "dietitian_dr_sharma" });
  assert.equal(withRef.ref, "dietitian_dr_sharma");

  const withoutRef = buildSubscriptionInput(base);
  assert.ok(!("ref" in withoutRef), "absent ref omitted");
});


// ─── F-9 / F-8: copy defects the flipbook caught, pinned here ───────────────

test("the sentence-case delivery label keeps its proper nouns capitalised", () => {
  // F-9. Two surfaces rendered `PLAN_DELIVERY_DAYS_LABEL.toLowerCase()`, which
  // lowercased "Monday to Friday" along with the leading "W" they wanted —
  // "Delivered weekdays, monday to friday, 12:30–1:30 pm."
  assert.equal(PLAN_DELIVERY_DAYS_SENTENCE, "weekdays, Monday to Friday");
  assert.ok(PLAN_DELIVERY_DAYS_SENTENCE.includes("Monday"), "Monday must stay capitalised");
  assert.ok(PLAN_DELIVERY_DAYS_SENTENCE.includes("Friday"), "Friday must stay capitalised");
  // Both forms state the same fact; only the first word differs in case.
  assert.equal(
    PLAN_DELIVERY_DAYS_SENTENCE.toLowerCase(),
    PLAN_DELIVERY_DAYS_LABEL.toLowerCase(),
    "the two forms must not drift apart in substance",
  );
});

test("no surface lowercases the delivery label wholesale any more", () => {
  // The regression this guards is a re-introduced `.toLowerCase()`, which is
  // how F-9 shipped in the first place — twice, in two components.
  const componentsDir = path.join(HERE, "..", "components");
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") &&
               fs.readFileSync(full, "utf8").includes("PLAN_DELIVERY_DAYS_LABEL.toLowerCase()")) {
        offenders.push(path.relative(componentsDir, full));
      }
    }
  };
  walk(componentsDir);
  assert.deepEqual(offenders, [], `use PLAN_DELIVERY_DAYS_SENTENCE instead: ${offenders.join(", ")}`);
});

test("F-8: the unserviceable line keeps its space after the PIN", () => {
  // The rendered DOM read "We don't deliver to 560001yet". A literal space
  // written after the interpolation is swallowed; an explicit {" "} is not.
  // Asserted against source because the defect is invisible in the JSX itself.
  const src = fs.readFileSync(
    path.join(HERE, "..", "components", "checkout", "plan", "PlanServiceabilityGate.tsx"),
    "utf8",
  );
  assert.ok(
    src.includes('{state.pincode}{" "}yet'),
    "the explicit {\" \"} after the PIN is load-bearing — see F-8",
  );
});
