/** The three cadences the plan builder (components/plans/PlanBuilder.tsx) can
 *  send via ?cycle= — a strict subset of ./api's PlanCadence (no
 *  "fortnightly", which the builder never offers). This is the one gate
 *  standing between an arbitrary query string on /checkout and what
 *  usePlanQuote / buildSubscriptionInput bill: an absent or unrecognised
 *  value must fall back to "monthly" (the builder's own default), never be
 *  passed through unchecked. */
export const BUILDER_CYCLES = ["weekly", "monthly", "quarterly"] as const;
export type BuilderCycle = (typeof BUILDER_CYCLES)[number];

export function asBuilderCycle(v: string | undefined): BuilderCycle | undefined {
  return BUILDER_CYCLES.includes(v as BuilderCycle) ? (v as BuilderCycle) : undefined;
}
