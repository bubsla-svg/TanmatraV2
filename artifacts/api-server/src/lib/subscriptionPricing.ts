// ─────────────────────────────────────────────────────────────────────────────
// Subscription price math — canonical implementation lives in
// `@workspace/subscription-rules` (pure, DB-free) so the web app's price
// displays import the exact same functions the server bills with and can
// never drift again. This module remains the stable server-side import path;
// both the /quote and the create path price through these re-exports.
// ─────────────────────────────────────────────────────────────────────────────

export {
  PER_MEAL_PAISE,
  CADENCE_DISCOUNT,
  TRIAL_DISCOUNT,
  TRIAL_3DAY_SUBTOTAL_PAISE,
  GST_RATE,
  computeDeliveryPricePaise,
  computeTrialPricePaise,
} from "@workspace/subscription-rules";
