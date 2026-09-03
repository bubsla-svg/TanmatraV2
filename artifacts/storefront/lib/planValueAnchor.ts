/**
 * The plan configurator's value line (T-21).
 *
 * "₹199/meal on plan · ₹199 avg à la carte" told the customer the plan saved
 * nothing — and it was true. A comparison is only worth printing when it
 * shows a saving a person would notice; otherwise the honest line is what
 * the plan is FOR. Both inputs are server/spine figures passed in; nothing
 * here authors a price.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */

/** Below this share of the à-la-carte figure a "saving" is noise. */
export const MIN_SAVING_RATIO = 0.05;

export type PlanValueAnchor =
  | { kind: "saving"; perMealPaise: number; savingPaise: number; savingPct: number }
  | { kind: "benefits" };

export function planValueAnchor(args: {
  perMealPaise: number | null | undefined;
  alacarteMedianPaise: number | null | undefined;
}): PlanValueAnchor {
  const per = args.perMealPaise;
  const median = args.alacarteMedianPaise;
  if (per == null || median == null || median <= 0) return { kind: "benefits" };
  const saving = median - per;
  if (saving / median < MIN_SAVING_RATIO) return { kind: "benefits" };
  return { kind: "saving", perMealPaise: per, savingPaise: saving, savingPct: Math.round((saving / median) * 100) };
}
