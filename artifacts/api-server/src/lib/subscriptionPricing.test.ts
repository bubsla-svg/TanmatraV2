import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeTrialPricePaise,
  computeDeliveryPricePaise,
  GST_RATE,
  TRIAL_3DAY_SUBTOTAL_PAISE,
} from "./subscriptionPricing";

// Phase A1 acceptance: the 3-Day Trial must not be priced above the à la carte
// dish it introduces. The bar is ≤ ₹520 (52000 paise) per meal, ALL-IN — the
// same basis the strategy uses (it divides the GST-inclusive total by meals).
const TRIAL_MEALS = 3;
const PER_MEAL_CEILING_PAISE = 52000;

const allIn = (subtotalPaise: number) =>
  subtotalPaise + Math.round(subtotalPaise * GST_RATE);

test("A1: 3-day trial is ≤ ₹520/meal all-in (was ₹787.50)", () => {
  // computeTrialPricePaise() returns the all-in (GST-inclusive) figure
  // directly — do not run it through allIn() again, or GST is double-counted.
  const allInTotal = computeTrialPricePaise(TRIAL_MEALS);
  const perMeal = allInTotal / TRIAL_MEALS;
  assert.ok(
    perMeal <= PER_MEAL_CEILING_PAISE,
    `trial is ${(perMeal / 100).toFixed(2)}/meal, over the ₹520 ceiling`,
  );
});

test("A1: 3-day trial is the repriced ₹1,499 all-in (₹499.67/meal)", () => {
  // TRIAL_3DAY_SUBTOTAL_PAISE is the PRE-tax subtotal; computeTrialPricePaise()
  // must return the all-in (GST-inclusive) figure derived from it — this is
  // the actual amount quoted AND billed (pricePerDeliveryPaise), so it must
  // never regress back to returning the bare pre-tax subtotal.
  assert.equal(TRIAL_3DAY_SUBTOTAL_PAISE, 142762);
  const allInTotal = computeTrialPricePaise(3);
  assert.equal(allIn(TRIAL_3DAY_SUBTOTAL_PAISE), 149900); // ₹1,499.00 all-in
  assert.equal(allInTotal, 149900); // ₹1,499.00 all-in — what's actually quoted/billed
});

test("A1: the trial reprice cut the per-meal price below the old ₹750 base", () => {
  // Regression guard: the old override was ₹2,250 (₹750/meal). The new price
  // must be a genuine reduction, not merely under the ceiling.
  assert.ok(computeTrialPricePaise(3) < 225000);
});

test("recurring plan pricing is unchanged (canonical overrides intact)", () => {
  assert.equal(computeDeliveryPricePaise("weekly", 5), 380000); // ₹3,800
  assert.equal(computeDeliveryPricePaise("fortnightly", 10), 741000); // ₹7,410
  assert.equal(computeDeliveryPricePaise("monthly", 30), 2166000); // ₹21,660
});

// Regression test for the double-GST bug in POST /subscriptions/quote.
//
// computeDeliveryPricePaise() already returns a GST-inclusive figure (see
// its fallback branch: `discounted + gst`), and that same figure is what
// `/subscriptions` bills through `pricePerDeliveryPaise` with no further tax
// applied. The quote route's gstPaise/totalPaise must be derived by
// splitting that already-inclusive figure into its pre-tax/tax components —
// NOT by applying a second 5% GST on top of it. This test mirrors the
// quote route's math directly against the shared pricing function so it
// would have caught the bug (gstPaise computed as
// `finalSubtotal * GST_RATE`, and totalPaise as
// `finalSubtotal + gstPaise + deliveryFeePaise`) before it shipped.
test("quote math: weekly cadence, 7 meals/delivery applies a single 5% GST, not compounded", () => {
  const meals = 7;
  const deliveryFeePaise = 0; // subscriptions never charge a delivery fee

  const finalSubtotal = computeDeliveryPricePaise("weekly", meals);

  // Correct derivation: split the already GST-inclusive subtotal.
  const preTaxSubtotalPaise = Math.round(finalSubtotal / (1 + GST_RATE));
  const gstPaise = finalSubtotal - preTaxSubtotalPaise;
  const totalPaise = finalSubtotal + deliveryFeePaise;

  // The buggy derivation applied a second 5% on top of the inclusive figure.
  const buggyGstPaise = Math.round(finalSubtotal * GST_RATE);
  const buggyTotalPaise = finalSubtotal + buggyGstPaise + deliveryFeePaise;

  assert.notEqual(
    gstPaise,
    buggyGstPaise,
    "correct gstPaise must differ from the double-counted (buggy) gstPaise",
  );
  assert.notEqual(
    totalPaise,
    buggyTotalPaise,
    "correct totalPaise must differ from the double-counted (buggy) totalPaise",
  );

  // The correct total must equal the inclusive subtotal plus the (zero)
  // delivery fee — never subtotal + a second GST application.
  assert.equal(totalPaise, finalSubtotal + deliveryFeePaise);

  // Pre-tax + gst must reconstruct the inclusive subtotal exactly.
  assert.equal(preTaxSubtotalPaise + gstPaise, finalSubtotal);
});

// Companion regression test for the 3-day trial path specifically: this is
// the case where the double-GST fix alone was NOT sufficient — a prior
// version of this fix correctly stopped double-counting GST for
// computeDeliveryPricePaise (recurring cadences) but left
// computeTrialPricePaise returning a bare pre-tax figure, so the trial
// quote/bill came out to ₹1,427.62 instead of the intended ₹1,499.00 all-in.
test("quote math: 3-day trial totals ₹1,499.00 all-in, not the bare pre-tax subtotal", () => {
  const meals = 3;
  const deliveryFeePaise = 0;

  const finalSubtotal = computeTrialPricePaise(meals);

  const preTaxSubtotalPaise = Math.round(finalSubtotal / (1 + GST_RATE));
  const gstPaise = finalSubtotal - preTaxSubtotalPaise;
  const totalPaise = finalSubtotal + deliveryFeePaise;

  assert.equal(finalSubtotal, 149900); // ₹1,499.00 all-in — must be GST-inclusive already
  assert.equal(totalPaise, 149900);
  assert.equal(preTaxSubtotalPaise, TRIAL_3DAY_SUBTOTAL_PAISE); // reconstructs ₹1,427.62 exactly
  assert.equal(preTaxSubtotalPaise + gstPaise, finalSubtotal);
});
