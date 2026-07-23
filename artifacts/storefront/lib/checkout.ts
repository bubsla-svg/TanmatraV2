/**
 * The Breeze checkout model (02c) — pure, so the load budget and the
 * "unrepresentable surfaces" are testable without rendering.
 *
 * Principle (02c §1): checkout load is decisions that belonged earlier, piling
 * up at the end. Everything below is already settled by the time checkout
 * begins; this file encodes what's LEFT (≤3 screens, one decision each) and
 * what can never appear here.
 */

export type CheckoutScreen = "identity" | "address" | "pay";

export interface CheckoutUser {
  signedIn: boolean;
  hasSavedAddress: boolean;
}

/**
 * The screens a given user sees (02c §3). Identity is skipped for signed-in
 * users; Address is skipped for a returning user with a saved address (it
 * renders pre-selected on Pay). Pay is always present. So: new user 3, a fully
 * returning user 1 — tap-only, zero typed fields.
 */
export function screensForUser(u: CheckoutUser): CheckoutScreen[] {
  const screens: CheckoutScreen[] = [];
  if (!u.signedIn) screens.push("identity");
  if (!u.hasSavedAddress) screens.push("address");
  screens.push("pay");
  return screens;
}

/** Decisions evicted from checkout — settled earlier, never re-asked here
 *  (02c §2). Coupon and COD are on this list because they do not exist. */
export const EVICTED_DECISIONS = [
  "plan",
  "duration",
  "meals",
  "preference",
  "serviceability",
  "rd_bump",
  "slot",
  "start_date",
  "coupon",
  "cod",
] as const;

/** Surfaces this checkout makes unrepresentable (02c §6). The UI must never
 *  render any of these; the model asserts their absence. */
export const FORBIDDEN_ELEMENTS = [
  "coupon_field",
  "cod_option",
  "slot_picker",
  "itemized_summary_wall",
  "tnc_paragraph",
] as const;

/** Falsifiable load budget (02c §4). */
export const BUDGET = {
  screensNewMax: 4,
  screensReturningMax: 2,
  typedFieldsNewMax: 4,
  typedFieldsReturningMax: 0,
  tapsToUpiNewMax: 9,
  tapsToUpiReturningMax: 3,
  decisionsPerScreen: 1,
  wordsAboveCtaMax: 40,
} as const;

export function typedFieldBudget(u: CheckoutUser): number {
  return u.signedIn && u.hasSavedAddress ? 0 : BUDGET.typedFieldsNewMax;
}

export const CERTAINTY = {
  identity: "You won't be charged yet.",
  address: "You won't be charged yet.",
} as const;
