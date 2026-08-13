/**
 * Landing page CRO event tracking helper (L-1). A closed set of event names
 * matching the Segment LP strategy and CRO build program.
 * NO "@/" alias imports permitted here per storefront lib rules.
 */

export type LpEventName =
  | "lp_view"
  | "hero_cta_click"
  // Clicks on the hero's announcement/offer strip. Separate from
  // hero_cta_click so campaign performance is measurable on its own —
  // "did the Diwali banner sell anything" is the question this slot exists
  // to answer. `label` carries the campaign id (see lib/heroCampaign.ts).
  | "hero_campaign_click"
  | "sticky_cta_click"
  | "plan_card_select"
  | "menu_preview_interact"
  | "calc_interact"
  | "faq_open"
  | "lead_submit"
  | "lead_success"
  | "lead_error"
  | "trial_checkout_start"
  | "assessment_start"
  | "assessment_step"
  | "assessment_complete"
  | "assessment_skip"
  | "spec_card_flip"
  | "protocol_card_select"
  | "waitlist_join";

export interface LpEventProps {
  page?: string;
  section?: string;
  planId?: string;
  track?: string;
  ref?: string;
  error?: string;
  [key: string]: string | number | boolean | undefined | null;
}

/** Fire-and-forget client-side event tracking for landing pages. */
export function emitLpEvent(
  event: LpEventName,
  props: LpEventProps = {},
): void {
  if (typeof window === "undefined") return; // Client-only
  const payload = JSON.stringify({ event, props, ts: Date.now() });
  try {
    const base = process.env["NEXT_PUBLIC_ANALYTICS_BEACON"];
    if (base && "sendBeacon" in navigator) {
      navigator.sendBeacon(base, payload);
    } else if (process.env.NODE_ENV !== "production") {
      console.debug("[lp-event]", event, props);
    }
  } catch {
    /* Analytics must never block UI or money path */
  }
}
