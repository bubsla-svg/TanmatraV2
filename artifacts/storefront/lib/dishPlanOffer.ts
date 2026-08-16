import {
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  poolForPlan,
  type PlanCycle,
  type PlanId,
} from "@workspace/subscription-rules";
import type { DishData } from "@workspace/menu-catalog";
import type { DietTrack } from "./api";
import { planDisplay } from "./planCopy";

/**
 * What a plan would actually cost for THIS dish, if it offers one at all.
 *
 * Plan item 1.1 asks the dish surface for an in-place one-time ↔ plan toggle
 * that "swaps server-quoted price, CTA copy, and per-delivery savings". Two
 * facts about the live catalog shape what that can honestly say, and both are
 * measured here rather than assumed:
 *
 *   1. MOST DISHES ARE IN NO BOOKABLE PLAN. Only `desk_fuel` and
 *      `protein_build` are `status: "live"` with a per-meal price; `steady` and
 *      `glp1_companion` are blocked pending SKUs, `teams` is sales-led, and the
 *      trial is one-off with no per-meal figure. 60 of 116 dishes appear in no
 *      live plan's rotation. For those there is nothing to toggle TO, and this
 *      returns null so the surface renders exactly today's one-time buy.
 *
 *   2. A PLAN IS OFTEN THE DEARER WAY TO EAT A GIVEN DISH. Of the 56 dishes
 *      that are in a live plan, a plan beats à-la-carte per delivery for 29,
 *      ties on 10, and is BEATEN on 17 — a ₹109 salad against a ₹199/meal plan.
 *      So `savingPaise` is null unless the saving is real and positive. A
 *      toggle that printed "save ₹-90" or quietly rounded it to zero would be
 *      the fabricated-benefit version of the same defect this workstream has
 *      spent its time removing from macros and renewal copy.
 *
 * Where several live plans carry the dish, the CHEAPEST per-delivery one wins.
 * That is not a recommendation dressed as a fact: it is the only choice that
 * cannot overstate what the dish costs on a plan, which is the single claim the
 * toggle makes.
 *
 * Pure and DOM-free — every figure is the spine's own (`computePlanQuote`'s
 * `pricePerMealPaise`), never divided or rounded here.
 */

export interface DishPlanOffer {
  planId: PlanId;
  /** Customer-facing plan name, from the shared copy module. */
  planName: string;
  /** The spine's own per-meal price. Not derived from the cycle total. */
  perDeliveryPaise: number;
  cycle: PlanCycle;
  mealsPerCycle: number;
  cycleTotalPaise: number;
  /**
   * What a plan delivery saves against this dish's à-la-carte price, or null
   * when a plan is the same price or dearer. Null is the common case and is
   * not an error state — the toggle simply makes no price claim.
   */
  savingPaise: number | null;
}

/** Every track a rotation can be drawn from. Widening the search, not a claim
 *  about what the customer eats — the toggle only asks "is this dish in the
 *  plan at all". */
const ALL_TRACKS: readonly DietTrack[] = ["veg", "egg", "nonveg"];

/**
 * Plans that can actually be bought today AND have a per-delivery price to
 * quote. Both halves matter: a blocked plan routes to a waitlist rather than a
 * checkout, and a plan with `pricePerMealPaise: null` (the trial, glp1) has no
 * per-delivery figure to put beside the dish's own.
 */
function quotablePlans(): { planId: PlanId; perDeliveryPaise: number }[] {
  const out: { planId: PlanId; perDeliveryPaise: number }[] = [];
  for (const planId of Object.keys(PLAN_CATALOG) as PlanId[]) {
    if (!planIsSelfServiceLaunchable(planId)) continue;
    const perDeliveryPaise = computePlanQuote(planId).pricePerMealPaise;
    if (perDeliveryPaise == null) continue;
    out.push({ planId, perDeliveryPaise });
  }
  return out;
}

export function dishPlanOffer(
  dishSlug: string,
  dishes: readonly DishData[],
): DishPlanOffer | null {
  const dish = dishes.find((d) => d.slug === dishSlug);
  if (!dish) return null;

  const carrying = quotablePlans().filter(({ planId }) =>
    ALL_TRACKS.some((track) => poolForPlan(planId, track, dishes).some((d) => d.slug === dishSlug)),
  );
  if (carrying.length === 0) return null;

  // Cheapest per delivery — see the header. Ties resolve by catalog order,
  // which is stable, so the same dish always offers the same plan.
  const best = carrying.reduce((a, b) => (b.perDeliveryPaise < a.perDeliveryPaise ? b : a));
  const quote = computePlanQuote(best.planId);
  const saving = dish.price - best.perDeliveryPaise;

  return {
    planId: best.planId,
    planName: planDisplay(best.planId).name,
    perDeliveryPaise: best.perDeliveryPaise,
    cycle: quote.cycle,
    mealsPerCycle: quote.mealsPerCycle,
    cycleTotalPaise: quote.cycleTotalPaise,
    savingPaise: saving > 0 ? saving : null,
  };
}
