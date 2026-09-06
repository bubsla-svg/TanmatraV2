import {
  TRIAL_CREDIT_PAISE,
  WEEKLY_PRICE_PAISE,
  applyTrialCreditPaise,
  computePlanQuote,
} from "@workspace/subscription-rules";

/**
 * 3-Day Taste Test (02b). The server owns eligibility (one per phone, EVER —
 * shipped in #287) and the credit grant; this module holds the pure display
 * facts: the fixed trio, the ₹399 price, and the creditback math, so the
 * storefront can never misstate the offer.
 */

/** The fixed trio per track — no query, no swaps (02e §3.5). */
export const TRIAL_TRIO: Record<"veg" | "nonveg", string[]> = {
  veg: ["barbeque-paneer-fiesta-rice-bowl", "paneer-tikka-burrito-wrap", "alfredo-pasta-veg"],
  nonveg: ["barbeque-grilled-chicken-rice-bowl", "chipotle-chicken-burrito-wrap", "alfredo-pasta-chicken"],
};

/** All-in trial price (₹399) — priced by the spine, never hardcoded here. */
export const TRIAL_PRICE_PAISE = computePlanQuote("trial_3day").cycleTotalPaise;

/** The creditback a paid trial earns (₹399), valid 7 days from trial end. */
export const TRIAL_CREDITBACK_PAISE = TRIAL_CREDIT_PAISE;

/** What a plan costs after the trial credit is applied (clamped ≥ 0). */
export function planTotalAfterCredit(planTotalPaise: number): number {
  return applyTrialCreditPaise(planTotalPaise);
}

/** The 02e §6 worked example, computed — trial + the credited first week must
 *  equal exactly the weekly price (₹1,199). Used by the copy and the test. */
export function trialPlusWeeklyPaise(): number {
  return TRIAL_PRICE_PAISE + planTotalAfterCredit(WEEKLY_PRICE_PAISE);
}

export const TRIAL_COPY = {
  creditLine: "Pay ₹399 once. Start a plan later and the ₹399 comes back as credit.",
  // "never auto-renews" is kept verbatim: it is the Law 5 denial a trial
  // surface must state (schema/subscriptions.ts:44-52), asserted by
  // cuj-04-trial.spec.ts — the copy deck's "Nothing renews" dropped it.
  noAutoConvert: "The trial never auto-renews. If you like it, continuing is one tap.",
} as const;
