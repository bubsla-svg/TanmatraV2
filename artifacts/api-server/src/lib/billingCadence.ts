// ─────────────────────────────────────────────────────────────────────────────
// The autopay cadence set and its billing-cycle lengths — the one place both
// answers live, because they must move together:
//
//   1. WHICH cadences mint a Razorpay recurring token at first payment
//      (the `isRecurring` gate in POST /payments/razorpay/order), and
//   2. HOW LONG a billed cycle is when that mandate is later charged
//      (upsertActiveMandate's first nextChargeAt, and chargeMandateCore's
//      advance after each successful charge).
//
// A standalone module (no route imports) on purpose: razorpayRecurring.ts is
// imported by routes/subscriptions.ts, so it cannot itself import
// routes/subscriptions.ts's CADENCE_DAYS without a cycle. The mapping below
// therefore RESTATES the delivery-cycle lengths, and billingCadence.test.ts
// pins the two tables to each other so they cannot drift.
//
// Why the billing period must equal the DELIVERY cycle step, not a calendar
// intuition: a "monthly" plan is priced as one cycleTotalPaise for one cycle
// of meals, and that cycle is the 6-week protocol (CADENCE_DAYS.monthly = 42).
// Billing it every 30 days would collect ~1.4 cycle payments per delivered
// cycle. One delivered cycle, one charge — so the charge recurs on the same
// step that generate-next schedules the next batch of deliveries with.
// ─────────────────────────────────────────────────────────────────────────────

import type { SubscriptionCadence } from "@workspace/db";

/**
 * Per-charge ceiling written into the Razorpay token block at mandate
 * registration (`max_amount`). ₹15,000 — the UPI Autopay limit under which
 * recurring debits need no additional factor authentication, so every charge
 * under it goes through without the customer re-approving.
 */
export const MANDATE_MAX_AMOUNT_PAISE = 1_500_000;

/**
 * Cadences that register a UPI Autopay mandate at first payment and are then
 * billed automatically each cycle.
 *
 * Quarterly is deliberately NOT here: protein_build non-veg quarterly bills
 * ₹16,799 per cycle (lib/subscription-rules planCatalog), which exceeds the
 * ₹15,000 `max_amount` ceiling above — a mandate registered under the ceiling
 * could never collect it. Quarterly therefore stays a prepaid single charge.
 * billingCadence.test.ts asserts this arithmetic against the live price table
 * so a repricing that changes the answer fails the build instead of silently
 * billing (or failing to bill) someone.
 */
export const AUTOPAY_CADENCES = ["weekly", "fortnightly", "monthly"] as const;

export type AutopayCadence = (typeof AUTOPAY_CADENCES)[number];

export function isAutopayCadence(
  cadence: SubscriptionCadence,
): cadence is AutopayCadence {
  return (AUTOPAY_CADENCES as readonly string[]).includes(cadence);
}

/**
 * cadence → billed-cycle length in days. Mirrors routes/subscriptions.ts's
 * CADENCE_DAYS (the delivery-scheduling table) value for value — see the
 * module header for why it is restated here rather than imported, and the
 * test for the pin that keeps them identical. Quarterly is mapped for
 * totality (a Subscription["cadence"] can hold it) but is unreachable for
 * billing while it stays outside AUTOPAY_CADENCES.
 */
export function billingCadenceDays(cadence: SubscriptionCadence): number {
  switch (cadence) {
    case "weekly":
      return 7;
    case "fortnightly":
      return 14;
    case "monthly":
      return 42; // the 6-week protocol cycle — NOT a 30-day calendar month.
    case "quarterly":
      return 126;
  }
}
