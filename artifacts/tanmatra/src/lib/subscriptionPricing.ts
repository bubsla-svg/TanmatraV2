/**
 * Subscription price-display utilities.
 *
 * A subscription is billed one full charge-cycle at a time (1 / 2 / 6 weeks),
 * but the price a customer reasons about is the *weekly cadence*. Showing the
 * full-cycle total against a "/2 weeks" unit (e.g. "₹3,544 /2 weeks") reads as
 * a weekly rate and mis-sells the plan. Every subscription price surface must
 * instead render a per-week rate with the actual billed amount and cadence
 * spelled out:  "₹X /week (Billed ₹Y every Z weeks)".
 *
 * These helpers are pure and take the ₹-formatter as an argument so they carry
 * no dependency on any view module and stay unit-testable in isolation.
 */
import type { SubscriptionCadence } from "./subscriptionsApi";

/** Weeks billed per charge cycle for each cadence (monthly = 6-week prepaid). */
export const CADENCE_WEEKS: Record<SubscriptionCadence, number> = {
  weekly: 1,
  fortnightly: 2,
  monthly: 6,
};

/** Weeks in one cycle, defaulting to 1 for any unexpected cadence value. */
export function cadenceWeeks(cadence: SubscriptionCadence): number {
  return CADENCE_WEEKS[cadence] || 1;
}

/**
 * Weekly-equivalent price (paise) derived from a full charge-cycle amount.
 * Rounded to the nearest paise so the displayed per-week figure is exact.
 */
export function weeklyEquivalentPaise(
  fullCyclePaise: number,
  cadence: SubscriptionCadence,
): number {
  return Math.round(fullCyclePaise / cadenceWeeks(cadence));
}

/**
 * The "Billed ₹Y every Z weeks" clause that must accompany a per-week rate so a
 * multi-week total is never mistaken for a weekly price. Weekly plans collapse
 * to "Billed weekly" (the amount already equals the per-week rate).
 * `fmt` renders a paise integer as a ₹ string.
 */
export function cadenceBilledLabel(
  fullCyclePaise: number,
  cadence: SubscriptionCadence,
  fmt: (paise: number) => string,
): string {
  const weeks = cadenceWeeks(cadence);
  if (weeks <= 1) return "Billed weekly";
  return `Billed ${fmt(fullCyclePaise)} every ${weeks} weeks`;
}

/**
 * Full standardized one-line label: "₹X /week (Billed ₹Y every Z weeks)".
 * Weekly plans collapse to "₹X /week" since the billed clause is redundant.
 */
export function formatCadencePriceLabel(
  fullCyclePaise: number,
  cadence: SubscriptionCadence,
  fmt: (paise: number) => string,
): string {
  const perWeek = `${fmt(weeklyEquivalentPaise(fullCyclePaise, cadence))} /week`;
  if (cadenceWeeks(cadence) <= 1) return perWeek;
  return `${perWeek} (${cadenceBilledLabel(fullCyclePaise, cadence, fmt)})`;
}
