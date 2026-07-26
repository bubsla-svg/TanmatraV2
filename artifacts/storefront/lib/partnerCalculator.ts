/**
 * Partner earnings & revenue projection arithmetic (L-5 & L-6).
 * Stands apart as a testable library module so relationship test suites can verify
 * pricing invariants (e.g. calc = planPrice × {0.10, 0.05, 0.05}).
 * NO "@/" alias imports permitted here per storefront lib rules.
 */

export interface GymCalcInput {
  members: number;
  adoptionRate: number;
  planPricePaise: number;
  tierRate: number;
}

export const GYM_COMMISSION_TIERS = [
  { rate: 0.10, pct: 10, label: "Gold / Exclusive" },
  { rate: 0.05, pct: 5, label: "Silver / Standard" },
  { rate: 0.05, pct: 5, label: "Bronze / Basic" },
] as const;

/** Compute estimated monthly gym ancillary revenue in paise. */
export function computeGymMonthlyEarnings(input: GymCalcInput): number {
  const activeSubscribers = Math.round(input.members * input.adoptionRate);
  return Math.round(activeSubscribers * input.planPricePaise * input.tierRate);
}
