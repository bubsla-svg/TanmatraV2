import {
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  type PlanId,
} from "@workspace/subscription-rules";
import { BUILDER_CYCLES } from "./checkoutCycle";
import { planDisplay } from "./planCopy";
import { planDecisionFacts, registersAutopayMandate, SKIP_SWAP_CUTOFF_HOURS } from "./planDecisionFacts";

/**
 * The "how it works" page's content, derived rather than written (plan item 2.1).
 *
 * The page has to state four things: what arrives, when, the skip/swap cutoff
 * in customer words, and the renewal truth. Every one of them already exists as
 * an enforced fact somewhere, and re-typing any of them into page copy is how a
 * help page ends up contradicting the checkout it is meant to explain:
 *
 *   - the delivery days and window come from the constants the create call
 *     books with (lib/planCheckout);
 *   - the cutoff comes from SKIP_SWAP_CUTOFF_MS, the shared constant the server
 *     enforces with;
 *   - the per-plan lines come from `planDecisionFacts` — the SAME function that
 *     renders the fine print beneath the pay button. If this page and that
 *     screen ever disagree, it will be because the function changed, which
 *     changes both.
 *
 * THE RENEWAL TRUTH IS KEYED ON THE CYCLE, NOT THE PLAN — and that distinction
 * is the whole reason this module exists rather than a paragraph of copy.
 *
 * Every bookable plan DEFAULTS to a non-renewing cycle (desk_fuel and
 * protein_build are monthly, the trial is one-off), so a page that reported
 * renewal per plan would print "does not renew" against all of them. But the
 * builder lets a customer pick WEEKLY (see BUILDER_CYCLES), and weekly
 * registers a real UPI Autopay mandate. That page would therefore be flatly
 * wrong for every customer who chose weekly — the exact question a help page
 * most has to get right.
 *
 * So each plan reports which of ITS CHOOSABLE cycles renew. A plan whose cycle
 * cannot be chosen (the one-off trial) reports only its own.
 */

export interface CycleRenewal {
  cycle: string;
  /** True when choosing this cycle really registers a recurring mandate. */
  renews: boolean;
}

export interface PlanHowItWorks {
  planId: PlanId;
  name: string;
  /** The cycle quoted when the customer arrives without choosing one. */
  defaultCycle: string;
  /** Every cycle this plan can actually be bought on, and whether each renews. */
  cycles: CycleRenewal[];
  /** The same lines the checkout prints beneath the pay button, for the default. */
  facts: string[];
}

/** Bookable plans only. A blocked or sales-led plan routes to a waitlist, so
 *  explaining "how it works" for one would describe a purchase nobody can make. */
export function bookablePlans(): PlanHowItWorks[] {
  return (Object.keys(PLAN_CATALOG) as PlanId[])
    .filter((planId) => planIsSelfServiceLaunchable(planId))
    .map((planId) => {
      const quote = computePlanQuote(planId);
      // A one-off plan has no cycle picker — offering it the builder's three
      // would describe a choice the trial does not have.
      const choosable: string[] =
        quote.cycle === "one_off" ? [quote.cycle] : [...BUILDER_CYCLES];
      return {
        planId,
        name: planDisplay(planId).name,
        defaultCycle: quote.cycle,
        cycles: choosable.map((cycle) => ({ cycle, renews: registersAutopayMandate(cycle as never) })),
        facts: planDecisionFacts(planId, undefined),
      };
    });
}

/**
 * Whether the bookable plans disagree about renewal — which decides whether the
 * page can state one renewal rule or must split.
 *
 * Computed rather than assumed: if every bookable plan ever became prepaid, a
 * page hard-coded to explain both cases would be describing a branch that no
 * longer exists.
 */
export function renewalIsMixed(plans: readonly PlanHowItWorks[] = bookablePlans()): boolean {
  const all = plans.flatMap((p) => p.cycles);
  return all.some((c) => c.renews) && all.some((c) => !c.renews);
}

/** The cutoff, in the words a customer would use. */
export const SKIP_SWAP_SENTENCE = `You can skip or swap any delivery up to ${SKIP_SWAP_CUTOFF_HOURS} hours before it arrives. A skipped meal comes back as credit — it is not lost, and you are not charged twice for it.`;
