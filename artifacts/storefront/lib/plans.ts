import {
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  planServesTrack,
  type PlanId,
  type DietTrack,
  type PlanQuote,
  type PlanCycle,
  PLAN_PRICE_TABLE,
  poolForPlan,
} from "@workspace/subscription-rules";
import { DISHES } from "@workspace/menu-catalog";

/**
 * Storefront adapter over the pure plan spine. The spine is the single source
 * of truth for prices and launch gates (IMP §10.1); this module only adds the
 * display copy the surfaces need. Copy marked INFERRED is drawn from 02/02a
 * and flagged until the IMPECCABLE copy system lands.
 */

// The plan display copy lives in ./planCopy — no catalog import there, so a
// component can ask for a plan's NAME without pulling 116 dishes into its
// bundle. Re-exported here so every existing consumer of `@/lib/plans` is
// unaffected by the split.
import { planDisplay, type PlanDisplay } from "./planCopy";
export { planDisplay, PLAN_DISPLAY, type PlanDisplay } from "./planCopy";

export const DIET_TRACKS: DietTrack[] = ["veg", "egg", "nonveg"];

/** Plans that appear on the goal router (self-serve, launchable, not the trial
 *  or the sales-led Teams). Order preserves the 02e table. */
export function routerPlans(): PlanDisplay[] {
  return (Object.keys(PLAN_CATALOG) as PlanId[])
    .filter((id) => PLAN_CATALOG[id].routerAnswer !== null && id !== "trial_3day")
    .map(planDisplay);
}

export interface PlanQuoteView {
  planId: PlanId;
  launchable: boolean;
  servedTracks: DietTrack[];
  /** Server-authoritative cycle total in paise (spine), for display. */
  cycleTotalPaise: number;
  perMealPaise: number | null;
  mealsPerCycle: number;
}

export function planQuoteView(id: PlanId): PlanQuoteView {
  const cfg = PLAN_CATALOG[id];
  const quote = computePlanQuote(id);
  return {
    planId: id,
    launchable: planIsSelfServiceLaunchable(id),
    servedTracks: DIET_TRACKS.filter((t) => planServesTrack(id, t)),
    cycleTotalPaise: quote.cycleTotalPaise,
    perMealPaise: cfg.pricePerMealPaise,
    mealsPerCycle: cfg.mealsPerCycle,
  };
}

/** Why a plan/track can't be booked self-serve — drives the zero-dead-end
 *  waitlist routing (02d §8). Null = bookable. */
export function bookingBlock(id: PlanId, track: DietTrack): string | null {
  if (!planIsSelfServiceLaunchable(id)) {
    return PLAN_CATALOG[id].blockers[0] ?? "not yet available for self-serve booking";
  }
  if (!planServesTrack(id, track)) {
    return `the ${track} track isn't served by ${planDisplay(id).name} yet`;
  }
  return null;
}

function computeMedian(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid] as number
    : Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

export interface TrackConfig {
  track: DietTrack;
  quotes: PlanQuote[];
  poolMedianPaise: number | null;
}

export interface PlanBuilderData {
  planId: PlanId;
  launchable: boolean;
  servedTracks: TrackConfig[];
}

export function getPlanBuilderData(id: PlanId): PlanBuilderData {
  const cfg = PLAN_CATALOG[id];
  const served = DIET_TRACKS.filter((t) => planServesTrack(id, t));

  const servedTracks = served.map((track) => {
    const pool = poolForPlan(id, track, DISHES);
    const poolMedianPaise = computeMedian(pool.map((d) => d.price));

    const quotes: PlanQuote[] = [];
    const tableEntry = (PLAN_PRICE_TABLE as any)[id]?.[track];

    if (cfg.cycle === "monthly") {
      if (tableEntry?.weeklyTotalPaise) {
        quotes.push(computePlanQuote(id, track, "weekly"));
      }
      if (tableEntry?.monthlyTotalPaise) {
        quotes.push(computePlanQuote(id, track, "monthly"));
      }
      if (tableEntry?.quarterlyTotalPaise) {
        quotes.push(computePlanQuote(id, track, "quarterly"));
      }
    } else {
      quotes.push(computePlanQuote(id, track, cfg.cycle));
    }

    return {
      track,
      quotes,
      poolMedianPaise,
    };
  });

  return {
    planId: id,
    launchable: planIsSelfServiceLaunchable(id),
    servedTracks,
  };
}
