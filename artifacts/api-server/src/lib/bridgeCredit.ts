// ─────────────────────────────────────────────────────────────────────────────
// À la carte → trial bridge credit (Phase C2) — PURE gating + discount math, so
// the money-affecting rules are unit-testable without Postgres.
//
// A customer's first à la carte order earns ONE meal credit (reason
// "alacarte_bridge"). It is redeemable exactly once, ONLY against a trial
// purchase, and only while unconsumed + unexpired. At trial checkout it applies
// as an explicit line item — the credit is a loyalty input, never folded into
// the base trial price (same discipline as the cart-math guards).
// ─────────────────────────────────────────────────────────────────────────────

/** One free meal, ledger-consistent with the meal-count `meal_credits.amount`. */
export const BRIDGE_CREDIT_MEALS = 1;

/** The credit lapses if the customer never starts a trial. */
export const BRIDGE_CREDIT_EXPIRY_DAYS = 30;

export interface RedeemableCredit {
  reason: string;
  consumedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * True iff this credit may be applied to the given purchase right now:
 * it's a bridge credit, unconsumed, unexpired, and the purchase is a trial.
 */
export function isBridgeCreditRedeemable(
  credit: RedeemableCredit,
  planType: "standard" | "trial",
  now: Date,
): boolean {
  return (
    credit.reason === "alacarte_bridge" &&
    credit.consumedAt == null &&
    (credit.expiresAt == null || credit.expiresAt.getTime() > now.getTime()) &&
    planType === "trial"
  );
}

/**
 * Paise discount for `creditMeals` free meals against a `trialMeals`-meal trial
 * priced at `trialPricePaise` — one meal's proportional share per credited meal,
 * capped at the number of meals in the trial and never exceeding the price.
 */
export function bridgeCreditDiscountPaise(
  creditMeals: number,
  trialMeals: number,
  trialPricePaise: number,
): number {
  if (trialMeals <= 0 || trialPricePaise <= 0) return 0;
  const meals = Math.min(Math.max(0, creditMeals), trialMeals);
  return Math.min(
    trialPricePaise,
    Math.round((trialPricePaise * meals) / trialMeals),
  );
}
