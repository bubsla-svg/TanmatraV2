// ─────────────────────────────────────────────────────────────────────────────
// Subscription price math — PURE (no DB import), so it is unit-testable without
// Postgres. `routes/subscriptions.ts` imports from here; both the /quote and the
// create path price through these functions, so displayed price can never drift
// from billed price.
// ─────────────────────────────────────────────────────────────────────────────

import type { SubscriptionCadence } from "@workspace/db"; // type-only — no runtime DB load

/** Base list price per meal (₹750). */
export const PER_MEAL_PAISE = 75000;

/** Recurring-plan discount by billing cadence (applied to the list subtotal). */
export const CADENCE_DISCOUNT: Record<SubscriptionCadence, number> = {
  weekly: 0.95,
  fortnightly: 0.9,
  monthly: 0.85,
};

/** First-order 3-day sampler: 25% off list (no cadence discount stacked). */
export const TRIAL_DISCOUNT = 0.75;

// Phase A1 — flat price of the marketed 3-Day Trial (the `meals === 3` case).
// A trial must not cost more per meal than the à la carte dish it introduces.
// ₹1,427.62 subtotal + 5% GST = ₹1,499.00 all-in ÷ 3 = ₹499.67/meal
// (was ₹2,250 subtotal → ₹2,362.50 all-in → ₹787.50/meal).
export const TRIAL_3DAY_SUBTOTAL_PAISE = 142762;

/** GST rate applied to the food subtotal. */
export const GST_RATE = 0.05;

export function computeDeliveryPricePaise(
  cadence: SubscriptionCadence,
  meals: number,
): number {
  // Checklist v1.2 canonical price overrides
  if (cadence === "weekly" && meals === 5) {
    return 380000; // ₹3,800
  }
  if (cadence === "fortnightly" && meals === 10) {
    return 741000; // ₹7,410
  }
  if (cadence === "monthly" && meals === 30) {
    return 2166000; // ₹21,660
  }
  // Fallback to proportional pricing based on base rate ₹750/meal and standard
  // cadence discounts plus 5% GST.
  const basePrice = meals * PER_MEAL_PAISE;
  const discountRate = CADENCE_DISCOUNT[cadence] ?? 1.0;
  const discounted = basePrice * discountRate;
  const gst = discounted * GST_RATE;
  return Math.round(discounted + gst);
}

export function computeTrialPricePaise(meals: number): number {
  if (meals === 3) {
    return TRIAL_3DAY_SUBTOTAL_PAISE; // ₹1,427.62 pre-tax subtotal (5% GST added on top gives the ₹1,499 all-in price, ₹499.67/meal)
  }
  // Fallback to proportional trial pricing (25% off base rate ₹750/meal) + 5% GST.
  const basePrice = meals * PER_MEAL_PAISE;
  const discounted = basePrice * TRIAL_DISCOUNT;
  const gst = discounted * GST_RATE;
  return Math.round(discounted + gst);
}
