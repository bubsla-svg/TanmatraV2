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
 * Only weekly and fortnightly reach mandate registration today — the cadence
 * gate in POST /payments/razorpay/order attaches Razorpay's `token` block for
 * no others, and without it no mandate is ever written.
 *
 * A lookup rather than a ternary on purpose. With `cadence === "fortnightly"
 * ? … : "Weekly"`, enabling autopay for a third cadence would silently start
 * telling those customers "Weekly payments" — which is precisely how the
 * fortnightly case came to be wrong. An unmapped cadence gets a sentence that
 * is general instead of one that is specific and false.
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
