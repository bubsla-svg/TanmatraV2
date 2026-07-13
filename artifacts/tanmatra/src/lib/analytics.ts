// First-party event tracker. Every event beacons to the API's
// /events endpoint (persisted in the funnel_events table, queryable by
// the existing admin analytics console), and additionally forwards to
// window.gtag when a vendor script is present — call sites never change.
import { API_BASE } from "./apiBase";

// Experimentation is deferred (CRO spec Amendment A6): v1 ships no
// assignment service, so every event carries an EMPTY experiment map
// (never null, never absent) plus the release cohort. When a platform
// lands later it slots in here without an event-version bump — copy and
// design iterations are read as `app_release` cohorts, not A/B splits.
const EXPERIMENT_ASSIGNMENTS: Record<string, string> = {};
const APP_RELEASE = "1.0.0";

type EventName =
  | "view_home"
  | "view_menu"
  | "view_product"
  | "add_to_cart"
  | "cart_open"
  | "upsell_focus"
  | "upsell_add"
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
  | "menu_filter_applied"
  | "plan_selected"
  | "plan_dish_swapped"
  | "pincode_unserviceable"
  | "auth_session_cookie_dropped";

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
        // A6: experimentation deferral — empty map + release cohort.
        experiment_assignments: EXPERIMENT_ASSIGNMENTS,
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
