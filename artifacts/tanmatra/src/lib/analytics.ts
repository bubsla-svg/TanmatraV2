// First-party event tracker. Every event beacons to the API's
// /events endpoint (persisted in the funnel_events table, queryable by
// the existing admin analytics console), and additionally forwards to
// window.gtag when a vendor script is present — call sites never change.
import { API_BASE } from "./apiBase";

// A6 activation (Playbook Part 8): assignments come from the config-driven
// bucketing util. The map stays EMPTY (never null, never absent) until an
// experiment is explicitly enabled in lib/experiments.ts, so this wiring
// changes nothing for un-experimented traffic; enabled experiments stamp a
// sticky per-device variant onto every event without an event-version bump.
import { getExperimentAssignments } from "./experiments";

const APP_RELEASE = "1.0.0";

type EventName =
  | "view_home"
  | "view_menu"
  | "view_product"
  | "add_to_cart"
  | "cart_open"
  | "upsell_focus"
  | "upsell_add"
  | "empty_cart_starter_add"
  | "free_delivery_unlocked"
  | "checkout_start"
  | "order_created"
  | "upi_intent_initiated"
  | "upi_intent_completed"
  | "first_order_offer_shown"
  | "first_order_offer_applied"
  | "subscription_activated"
  | "post_trial_continue_clicked"
  | "post_trial_continue_success"
  | "support_click"
  | "softgate_start"
  | "softgate_complete"
  | "softgate_skip"
  | "post_checkout_wizard_shown"
  | "post_checkout_wizard_completed"
  | "post_checkout_wizard_skipped"
  | "home_cta_click"
  | "home_program_tap"
  // Phase C — à la carte → trial → subscription bridge funnel.
  | "alacarte_order_placed"
  | "bridge_cta_shown"
  | "bridge_cta_clicked"
  | "trial_started"
  | "trial_credit_redeemed"
  | "subscription_started"
  | "menu_filter_applied"
  | "plan_selected"
  | "plan_dish_swapped"
  | "pincode_unserviceable"
  | "auth_session_cookie_dropped"
  // Reconciled v1.2 Checklist events
  | "hero_cta_clicked"
  | "goal_selected"
  | "section_viewed"
  | "plan_card_viewed"
  | "pricing_card_clicked"
  | "bar_state_transition"
  | "assessment_started"
  | "pdp_viewed"
  | "pdp_gallery_swiped"
  | "pdp_variant_switched"
  | "fit_explanation_expanded"
  | "full_nutrition_opened"
  | "customize_opened"
  | "add_committed"
  | "dish_card_impression"
  | "dish_sheet_opened"
  | "delivery_frequency_selected"
  | "subscription_config_started"
  | "protocol_duration_selected"
  | "billing_period_selected"
  | "subscription_selected"
  | "delivery_schedule_completed"
  | "checkout_started"
  | "address_validated"
  | "price_quote_viewed"
  | "payment_method_selected"
  | "payment_initiated"
  | "payment_succeeded"
  | "order_confirmed"
  | "mandate_created"
  | "mandate_authorization_failed"
  | "money_path_error"
  | "predebit_notified"
  | "mandate_revoked"
  // Trial → subscription bridge (SubscriptionBridge.tsx recap screen).
  | "trial_bridge_viewed"
  | "trial_bridge_cta"
  | "trial_bridge_outcome"
  // PR05 plan-first PDP — macro gate unlock + allergen acknowledge-and-proceed.
  | "gate_unlock"
  | "allergen_ack"
  // ── Playbook Part 8 dictionary (docs/e2e-master-playbook-noida-ncr.md) ──
  // Acquisition & landing pages.
  | "landing_viewed"
  | "landing_cta_clicked"
  | "serviceability_checked"
  | "waitlist_joined"
  // Clinical intake quiz (paired step events; Segment step pattern).
  | "quiz_opened"
  | "quiz_step_viewed"
  | "quiz_step_completed"
  | "quiz_completed"
  | "quiz_abandoned"
  // Checkout & subscribe wizards (paired step events).
  | "checkout_step_viewed"
  | "checkout_step_completed"
  | "address_added"
  | "slot_selected"
  | "payment_attempted"
  | "subscribe_step_viewed"
  | "subscribe_step_completed"
  | "subscribe_quote_shown"
  // Retention & clinical surfaces.
  | "delivery_skipped"
  | "delivery_unskipped"
  | "subscription_paused"
  | "subscription_resumed"
  | "subscription_cancelled"
  | "swap_requested"
  | "swap_rejected"
  | "planner_week_generated"
  | "planner_week_accepted"
  | "planner_day_regenerated"
  | "streak_viewed"
  | "streak_milestone_reached"
  | "trial_recap_viewed"
  | "trial_converted"
  | "rd_appointment_booked"
  | "rd_message_sent"
  | "rd_lab_shared"
  | "progress_logged"
  | "challenge_joined"
  | "challenge_checkin_attended"
  | "referral_shared"
  | "referral_redeemed"
  | "credit_redeemed"
  // B2B & owned-channel marketing.
  | "corporate_lead_submitted"
  | "corporate_calculator_used"
  | "office_order_pick_made"
  | "office_order_closed"
  | "whatsapp_optin"
  | "whatsapp_link_clicked";

// Health-adjacent or personal keys never leave the device — the server
// scrubs them again, but the first line of defence is here.
const BLOCKED_PROP_KEYS = new Set([
  "allergens",
  "conditions",
  "medicalConditions",
  "phone",
  "email",
  "address",
  "name",
]);

function sessionId(): string {
  try {
    let sid = sessionStorage.getItem("tanmatra:sid");
    if (!sid) {
      sid = crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("tanmatra:sid", sid);
    }
    return sid;
  } catch {
    return "no-session";
  }
}

export function track(event: EventName, props?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.debug(`[analytics] ${event}`, props);
  }
  const clean: Record<string, unknown> = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (BLOCKED_PROP_KEYS.has(k)) continue;
      clean[k] = v;
    }
  }
  try {
    // keepalive lets the beacon survive page navigations, like sendBeacon,
    // while keeping a JSON content-type the API parses natively.
    void fetch(`${API_BASE}/events`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: event,
        props: Object.keys(clean).length > 0 ? clean : undefined,
        sessionId: sessionId(),
        path: typeof location !== "undefined" ? location.pathname : undefined,
        ts: Date.now(),
        // A6: sticky per-device assignments; {} until an experiment is enabled.
        experiment_assignments: getExperimentAssignments(),
        app_release: APP_RELEASE,
      }),
    }).catch(() => undefined);
  } catch {
    // never let analytics crash the app
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag?.("event", event, clean);
  } catch {
    // never let analytics crash the app
  }
}
