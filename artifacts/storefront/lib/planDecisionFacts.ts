import {
  SKIP_SWAP_CUTOFF_MS,
  PLAN_CATALOG,
  type PlanId,
  type PlanCycle,
} from "@workspace/subscription-rules";
import type { PlanCadence } from "./api";

/**
 * What a customer must be told BEFORE paying for a plan (Laws 5 and 6).
 *
 * The trial already carried decision-time fine print — the creditback line and
 * "never auto-renews" — wired in app/(focus)/checkout/page.tsx. Plans passed
 * `finePrint={undefined}`. So the cheaper, non-recurring purchase disclosed
 * its terms and the one that registers a recurring UPI Autopay mandate
 * disclosed nothing: the buyer saw a total and "Billed each cycle", with no
 * statement of what arrives, when the next charge lands, or that a delivery
 * can be skipped at all.
 *
 * Every line here is derived, never authored as a literal:
 *
 *  - the cutoff comes from SKIP_SWAP_CUTOFF_MS, the same constant the server
 *    enforces with, so the promise cannot drift from the rule (that shared
 *    constant exists for exactly this reason — see its own header);
 *  - meals-per-cycle and the cycle word come from the plan catalog;
 *  - the amount is NOT restated. The server owns it and PlanDetails already
 *    renders the quoted total; repeating a number here would be a second
 *    source for the one value that must have only one.
 *
 * Deliberately absent: a literal next-charge DATE. The client does not know
 * when the server will bill, and a date is the kind of specific that gets
 * believed. Cadence stated as a period is true and useful; an invented date is
 * neither.
 */

/** Hours a customer has to skip or swap, from the shared enforcement constant. */
export const SKIP_SWAP_CUTOFF_HOURS = Math.round(SKIP_SWAP_CUTOFF_MS / 3_600_000);

/**
 * The cadences that actually set up a recurring charge.
 *
 * Not a product decision restated here — it is what the server does. At order
 * creation (api-server routes/payments.ts) the Razorpay `token` block, which is
 * what makes a payment a mandate registration, is attached only when
 * `sub.cadence === "weekly" || sub.cadence === "fortnightly"` and the
 * subscription is not a live trial. Without that block Razorpay returns no
 * `token_id`, `registerAutopayMandate` bails, no `subscription_mandates` row
 * exists, and `chargeMandateScheduler` — which sweeps active mandate rows —
 * has nothing to charge. A monthly or quarterly plan therefore never bills
 * itself a second time.
 *
 * So "does it auto-renew?" has no single answer for this product: it depends on
 * the cadence the customer picked, and the default one (monthly) does not.
 */
const AUTOPAY_CADENCES: readonly (PlanCadence | PlanCycle)[] = ["weekly", "fortnightly"];

export function registersAutopayMandate(cadence: PlanCadence | PlanCycle): boolean {
  return AUTOPAY_CADENCES.includes(cadence);
}

/**
 * Every cadence the checkout can pass. `PlanCadence` (lib/api) carries
 * `fortnightly`, which the catalog's own PlanCycle does not — an exhaustive
 * Record makes the compiler, not a reviewer, catch the day a fifth is added.
 */
const CYCLE_NOUN: Record<PlanCadence | PlanCycle, string> = {
  weekly: "week",
  fortnightly: "fortnight",
  monthly: "month",
  quarterly: "quarter",
  one_off: "one-off",
};

/**
 * The fine print shown beneath a plan's pay action.
 *
 * Returns [] for an unknown plan id rather than throwing or emitting a
 * half-sentence: a checkout must not break because the catalog moved, and a
 * partial promise is worse than none.
 */
export function planDecisionFacts(
  planId: PlanId,
  /**
   * The cadence the builder confirmed. UNDEFINED when the customer arrived
   * without ?cycle=, in which case the plan's OWN cycle is what gets quoted and
   * billed — so that is what must be described. Defaulting to "monthly" here
   * would caption a one-off purchase as a monthly subscription, which is the
   * exact mistake checkout/page.tsx's own comment warns against for the quote.
   */
  cadence: PlanCadence | undefined,
): string[] {
  const config = PLAN_CATALOG[planId];
  if (!config) return [];

  const effective: PlanCadence | PlanCycle = cadence ?? config.cycle;
  const period = CYCLE_NOUN[effective];
  const meals = config.mealsPerCycle;
  const slots = config.slots.join(" and ");

  const arrives = `${meals} ${meals === 1 ? "meal" : "meals"} — ${slots} on your delivery days.`;
  const cutoff = `Skip or swap any delivery up to ${SKIP_SWAP_CUTOFF_HOURS} h before it arrives; skipped meals come back as credit.`;

  // A one-off plan does not renew, and saying it does would be the Law 5
  // violation this module exists to prevent — committed at the pay button.
  if (effective === "one_off") {
    return [arrives, cutoff, "A one-time purchase — this does not renew and sets up no recurring charge."];
  }

  const recurring = `${meals} ${meals === 1 ? "meal" : "meals"} per ${period} — ${slots} on your delivery days.`;

  // Only an AUTOPAY cadence renews itself. Anything else is prepaid, and
  // saying otherwise is the same Law 5 violation as the one-off case — with a
  // worse ending, because a customer who believes deliveries continue simply
  // stops receiving them on a date nobody warned them about.
  if (!registersAutopayMandate(effective)) {
    return [
      recurring,
      cutoff,
      `Paid once for this ${period}. Nothing renews automatically and no recurring charge is set up — come back to buy the next ${period} when you want it.`,
    ];
  }

  return [
    recurring,
    cutoff,
    `Renews every ${period} by UPI Autopay until you cancel, with a notification before each charge. Cancel any time before the next one — there is no lock-in.`,
  ];
}
