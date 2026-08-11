// ─────────────────────────────────────────────────────────────────────────────
// Subscription lifecycle rules (pure, DB-free — unit-testable without Postgres,
// and safe to import from the browser bundle).
//
// The customer-facing promise is "skip/swap up to 24 h before delivery". That
// cutoff is enforced server-side (see @workspace/api-server's
// subscriptions.ts routes) and this module is the single source of truth for
// the cutoff value so the API and the UI can never drift apart: the server
// imports it to reject late mutations with a 409, and the web app imports the
// exact same constant to grey out the Skip/Swap/Reschedule controls before the
// user ever taps them.
// ─────────────────────────────────────────────────────────────────────────────

/** Skip / swap / reschedule must happen at least this long before the delivery's scheduled time. */
export const SKIP_SWAP_CUTOFF_MS = 24 * 60 * 60 * 1000;

/**
 * True when a delivery is inside the cutoff window (too close to its scheduled
 * time to skip, swap, or reschedule). A delivery already in the past is also
 * "past cutoff". `now` is injectable for tests.
 */
export function isPastSkipCutoff(
  scheduledFor: Date | string | number,
  now: number = Date.now(),
): boolean {
  const t =
    scheduledFor instanceof Date
      ? scheduledFor.getTime()
      : new Date(scheduledFor).getTime();
  if (Number.isNaN(t)) return false; // unknown schedule → don't block on a bad value
  return t - now < SKIP_SWAP_CUTOFF_MS;
}

export {
  type SubscriptionCadence,
  PER_MEAL_PAISE,
  CADENCE_DISCOUNT,
  cadenceDiscountPct,
  MAX_CADENCE_DISCOUNT_PCT,
  TRIAL_DISCOUNT,
  TRIAL_3DAY_SUBTOTAL_PAISE,
  TRIAL_DAYS,
  TRIAL_MEALS_PER_DAY,
  TRIAL_MEALS,
  GST_RATE,
  computeDeliveryPricePaise,
  computeTrialPricePaise,
} from "./pricing.js";

// ── Corpus 02e plan catalog (the "replace the live model" spine) ─────────────
// Introduced additively; quote/create routes and web surfaces are re-pointed at
// it in later slices (see IMPLEMENTATION-PLAN.md). See planCatalog.ts header for
// the inferred-value flags carried until IMPECCABLE.md / Amendment 02 land.
export {
  type PlanId,
  type DietTrack,
  type PlanCycle,
  type PlanSlot,
  type AddOnId,
  type PlanStatus,
  type PoolQueryId,
  type PlanConfig,
  type AddOnConfig,
  type AddOnLineItem,
  type PoolPredicate,
  type TrackLaunchState,
  type PlanQuote,
  type PlanPriceCycleAmounts,
  PLAN_PRICE_TABLE,
  PLAN_CATALOG,
  ADD_ONS,
  attachableAddOns,
  resolveAddOns,
  BUILDER_DEFAULTS,
  type TrialCreditGrant,
  TRIAL_CREDIT_PAISE,
  TRIAL_CREDIT_VALIDITY_DAYS,
  WEEKLY_PRICE_PAISE,
  MONTHLY_PRICE_PAISE,
  applyTrialCreditPaise,
  trialCreditExpiry,
  trialCreditGrant,
  TRIAL_TRIOS,
  POOL_PREDICATES,
  isServable,
  dishTrack,
  poolForPlan,
  trackLaunchState,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  planServesTrack,
  ROUTER_ANSWER_TO_PLAN,
  planForCondition,
  type B2BSeatTier,
  type CorporateInvoiceQuote,
  TEAMS_SEAT_TIERS,
  computeCorporateTeamsQuote,
} from "./planCatalog.js";
