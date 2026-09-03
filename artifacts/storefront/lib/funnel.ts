/**
 * CUJ funnel vocabulary (02d §9). A closed set of event names so the funnel
 * scoreboard can be wired without renaming later. Emission is a fire-and-forget
 * beacon — analytics must never block or break the money path. The real sink
 * lands with the benchmark scoreboard (Phase 3); until then this posts to the
 * api-server's analytics beacon when configured, and no-ops on the server.
 */

import { currentAttribution } from "./acquisition";

export type FunnelEvent =
  | "cuj_router_answer"
  | "cuj_plan_viewed"
  | "cuj_track_selected"
  | "cuj_builder_confirm"
  | "cuj_waitlist_captured"
  | "cuj_checkout_start"
  | "cuj_paid"
  // ── Money path (Phase 3.3 canonical names) ────────────────────────────────
  // The `cuj_*` set above measures the browse-and-choose half. The purchase
  // half was measured by exactly one event, `cuj_paid`, emitted from
  // CheckoutFlow's `pay()` AFTER its `if (LIVE_CHECKOUT_ENABLED) … return` —
  // so it can only fire when live checkout is switched OFF. In production the
  // storefront's only conversion event is unreachable, and the two paths that
  // actually take money (AlacarteCheckout, PlanCheckout) emitted nothing at
  // all. A funnel with no bottom cannot show where anyone drops out.
  //
  // Amounts are named `_paise`, not the canonical list's `_cents`: this
  // product bills in INR and the whole codebase counts paise, so "cents" would
  // name a unit that does not exist here — the kind of small lie that only
  // surfaces after someone has divided by 100.
  | "begin_checkout"
  | "payment_opened"
  | "payment_failed"
  | "checkout_complete"
  | "subscription_created"
  // ── Dish surface (plan item 1.1) ──────────────────────────────────────────
  // The step between "saw the menu" and "began checkout", which nothing
  // measured. `plan_toggle` in particular is the only way to learn whether the
  // plan option is being considered and declined, or simply never seen — two
  // very different problems that look identical in a funnel without it.
  | "view_dish"
  | "plan_toggle"
  | "subscribe_cta_click"
  // ── Retention (plan item 2.2) ─────────────────────────────────────────────
  // The account surface emitted NOTHING — `emitFunnel` appeared nowhere under
  // components/account. So a plan could be paused, skipped or cancelled and
  // the scoreboard showed only that it was created.
  //
  // The inverses are not padding. A pause counted without its resume cannot
  // tell a holiday from churn, and a skip counted without its restore reads as
  // dissatisfaction when it was a Tuesday meeting. Counting only the negative
  // half of a reversible action is how a retention number becomes alarming and
  // wrong at the same time.
  | "subscription_skipped"
  | "subscription_unskipped"
  | "subscription_paused"
  | "subscription_resumed"
  | "subscription_rescheduled"
  | "subscription_cancelled"
  // ── Guest → account (plan item 2.4) ───────────────────────────────────────
  // The offer is counted separately from the claim because the ratio is the
  // interesting number. A low claim count could mean the prompt is being
  // ignored, or that almost nobody reaches the confirmation screen as a guest
  // in the first place — opposite problems that look identical without both.
  | "order_claim_offered"
  | "order_claimed"
  // ── Printed-code acquisition (QR funnel) ──────────────────────────────────
  // A scan is counted SERVER-side (the `qr_scans` table, written by the
  // /q/[src] redirect) because a visitor who bounces off the landing never
  // runs any of this. These are the steps that follow it, and each one is here
  // because the placement scoreboard is a RATIO: without the pincode step you
  // cannot tell a poster in an unserved sector from a poster nobody looked at,
  // and those two failures have opposite fixes (move the poster vs. change the
  // creative).
  | "qr_landing_view"
  | "qr_pincode_serviceable"
  | "qr_pincode_unserviceable"
  // The "phone" step of scan → pincode → phone → paid. Nothing emitted when an
  // OTP was accepted, so the single largest drop-off in the funnel — people who
  // reach the sign-in wall and leave — was invisible between begin_checkout and
  // the payment events.
  | "identity_verified";

/**
 * A stable, groupable cause for `payment_failed`.
 *
 * Deliberately NOT the humanized sentence: that copy is written to be read by a
 * customer and is expected to change, so grouping a scoreboard by it would
 * split one cause across every rewording. `ApiError.code` is the server's own
 * machine code and is the thing worth counting.
 *
 * Typed loosely (`unknown`) because it is called from a catch block, where the
 * value genuinely can be anything.
 */
export function funnelErrorCode(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return "unknown";
}

export function emitFunnel(
  event: FunnelEvent,
  props: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === "undefined") return; // client-only
  // Shape matches the api-server sink's schema (routes/events.ts: `name`,
  // `props`, `path`, `ts`). This posted `{ event, … }` for its first weeks —
  // a key the sink's zod schema does not know — so every beacon that reached
  // the server was validated away and silently dropped (the sink answers 204
  // to everything by design). The payload key IS the contract; a rename on
  // either side must move both.
  // Attribution is stamped HERE rather than at each call site, and that is the
  // difference between a scoreboard and a pile of counts. Every one of the ~30
  // events above would otherwise have to remember to pass `src`, and the ones
  // that forgot would silently drop out of the placement funnel while still
  // looking correct in isolation. `sessionId` is the join key back to the
  // `qr_scans` row the redirect wrote before any of this code existed.
  const { src, sessionId } = currentAttribution();
  const payload = JSON.stringify({
    name: event,
    props: src ? { ...props, src } : props,
    ...(sessionId ? { sessionId } : {}),
    path: window.location?.pathname ?? undefined,
    ts: Date.now(),
  });
  try {
    const base = process.env.NEXT_PUBLIC_ANALYTICS_BEACON;
    if (base && "sendBeacon" in navigator) {
      navigator.sendBeacon(base, payload);
    } else if (process.env.NODE_ENV !== "production") {
      // Visible in dev without an analytics sink wired.
      console.debug("[funnel]", event, props);
    }
  } catch {
    /* analytics is best-effort — never throw into the flow */
  }
}
