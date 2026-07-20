// ─────────────────────────────────────────────────────────────────────────────
// Subscription price math — PURE (no DB import), single source of truth for
// every surface that renders or bills a subscription price.
//
// The api-server's /subscriptions/quote and create paths price through these
// exact functions (via its `lib/subscriptionPricing.ts` re-export), and the
// web app's Subscribe wizard fallback + plan landing pages import them
// directly — so a marketed price can never drift from the billed price again.
// (This module replaced three divergent client copies: ₹260/meal on the plans
// landing, ₹750 + no-weekly-discount in the wizard fallback, and the server's
// authoritative version below.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Billing cadence for recurring plans. Mirrors the DB enum in
 * `@workspace/db` (`lib/db/src/schema/subscriptions.ts`) — kept as a local
 * literal union so this module stays browser-safe with no DB dependency.
 */
export type SubscriptionCadence = "weekly" | "fortnightly" | "monthly";

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

/** All-in (GST-inclusive) price for one recurring delivery of `meals` meals. */
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

/** All-in (GST-inclusive) price for a one-off trial of `meals` meals. */
export function computeTrialPricePaise(meals: number): number {
  if (meals === 3) {
    // ₹1,427.62 pre-tax subtotal + 5% GST = ₹1,499.00 all-in (₹499.67/meal).
    // Must return the all-in figure — same contract as computeDeliveryPricePaise
    // above — since callers (the /subscriptions/quote route and the
    // pricePerDeliveryPaise stored at subscription-creation time) both treat
    // this return value as already GST-inclusive.
    return Math.round(TRIAL_3DAY_SUBTOTAL_PAISE * (1 + GST_RATE));
  }
  // Fallback to proportional trial pricing (25% off base rate ₹750/meal) + 5% GST.
  const basePrice = meals * PER_MEAL_PAISE;
  const discounted = basePrice * TRIAL_DISCOUNT;
  const gst = discounted * GST_RATE;
  return Math.round(discounted + gst);
}
