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
  const subtotal = computeTrialPricePaise(TRIAL_MEALS);
  const perMeal = allIn(subtotal) / TRIAL_MEALS;
  assert.ok(
    perMeal <= PER_MEAL_CEILING_PAISE,
    `trial is ${(perMeal / 100).toFixed(2)}/meal, over the ₹520 ceiling`,
  );
});

test("A1: 3-day trial is the repriced ₹1,499 all-in (₹499.67/meal)", () => {
  assert.equal(TRIAL_3DAY_SUBTOTAL_PAISE, 142762);
  const subtotal = computeTrialPricePaise(3);
  assert.equal(subtotal, 142762); // ₹1,427.62 subtotal
  assert.equal(allIn(subtotal), 149900); // ₹1,499.00 all-in
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
