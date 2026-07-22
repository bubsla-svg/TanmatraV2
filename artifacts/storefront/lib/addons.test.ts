// Attach math invariants (02 §5 / 02a §4). Run with the api-server tsx loader:
//   cd artifacts/api-server && node --test --import tsx ../storefront/lib/addons.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { computePlanQuote } from "@workspace/subscription-rules";
import { addOnView, planAllowsAddOn, checkoutTotalWithAddOns } from "./addons";

test("the add-ons are spine-priced: RD bump ₹499/mo, Evening Add ₹599/week", () => {
  const rd = addOnView("rd_bump");
  const eve = addOnView("evening_add");
  assert.equal(rd.pricePaise, 49900);
  assert.equal(rd.cadence, "monthly");
  assert.equal(rd.attachPoint, "plan_review");
  assert.equal(eve.pricePaise, 59900);
  assert.equal(eve.cadence, "weekly");
  assert.equal(eve.attachPoint, "post_purchase");
});

test("the RD bump adds exactly ₹499 to Desk Fuel's checkout bill", () => {
  const base = computePlanQuote("desk_fuel").cycleTotalPaise; // ₹4,378
  const withBump = checkoutTotalWithAddOns("desk_fuel", ["rd_bump"]);
  assert.equal(withBump.basePaise, base);
  assert.equal(withBump.addOnPaise, 49900);
  assert.equal(withBump.totalPaise, base + 49900);
  assert.equal(withBump.items.length, 1);
  assert.equal(withBump.items[0]?.id, "rd_bump");
});

test("Evening Add is post-purchase — it never touches the checkout total", () => {
  const base = computePlanQuote("desk_fuel").cycleTotalPaise;
  const t = checkoutTotalWithAddOns("desk_fuel", ["evening_add"]);
  assert.equal(t.addOnPaise, 0);
  assert.equal(t.totalPaise, base);
  assert.equal(t.items.length, 0);
});

test("a plan's allow-list is enforced — Protein Build has no RD bump", () => {
  // protein_build allows only evening_add (02e §2).
  assert.equal(planAllowsAddOn("protein_build", "evening_add"), true);
  assert.equal(planAllowsAddOn("protein_build", "rd_bump"), false);
  // A rejected add-on is dropped, not priced.
  const base = computePlanQuote("protein_build").cycleTotalPaise;
  const t = checkoutTotalWithAddOns("protein_build", ["rd_bump"]);
  assert.equal(t.addOnPaise, 0);
  assert.equal(t.totalPaise, base);
});

test("desk_fuel permits both attach points; trial permits none", () => {
  assert.equal(planAllowsAddOn("desk_fuel", "rd_bump"), true);
  assert.equal(planAllowsAddOn("desk_fuel", "evening_add"), true);
  assert.equal(planAllowsAddOn("trial_3day", "rd_bump"), false);
  assert.equal(planAllowsAddOn("trial_3day", "evening_add"), false);
});
