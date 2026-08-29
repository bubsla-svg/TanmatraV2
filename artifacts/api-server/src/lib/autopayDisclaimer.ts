/**
 * The sentence a customer is shown once a UPI Autopay mandate has actually
 * been registered against their subscription.
 *
 * Returned from POST /payments/razorpay/verify and carried verbatim onto the
 * storefront's confirmation screen (lib/postCheckout stashes it), so it is read
 * by the customer exactly as written here — no client-side rewording.
 *
 * It was a single literal reading "Weekly payments use UPI Autopay…", and
 * mandates are registered for weekly AND fortnightly cadences, so every
 * fortnightly customer was told the wrong billing frequency at the one moment
 * they were being told a recurring charge exists at all.
 *
 * Split out of routes/payments.ts to be unit-testable without a database: the
 * route module reaches the DB at import time, so the copy could not otherwise
 * be asserted except through a full integration run.
 */

/**
 * Weekly, fortnightly and monthly reach mandate registration — the cadence
 * gate in POST /payments/razorpay/order (see lib/billingCadence.ts's
 * AUTOPAY_CADENCES) attaches Razorpay's `token` block for no others, and
 * without it no mandate is ever written.
 *
 * A lookup rather than a ternary on purpose. With `cadence === "fortnightly"
 * ? … : "Weekly"`, enabling autopay for a third cadence would silently start
 * telling those customers "Weekly payments" — which is precisely how the
 * fortnightly case came to be wrong. An unmapped cadence gets a sentence that
 * is general instead of one that is specific and false.
 *
 * Monthly is autopay-eligible yet DELIBERATELY unmapped: its billed cycle is
 * the 6-week protocol (billingCadenceDays("monthly") = 42 days), so "Monthly
 * payments" would be the same specific-and-false substitution this map exists
 * to prevent. The general sentence is the honest one for it.
 */
const AUTOPAY_PERIOD_WORD: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
};

export function autopayDisclaimerFor(cadence: string): string {
  const period = AUTOPAY_PERIOD_WORD[cadence];
  const subject = period ? `${period} payments` : "Payments for this plan";
  return `${subject} use UPI Autopay. You'll get a notification at least 24 hours before each charge.`;
}
