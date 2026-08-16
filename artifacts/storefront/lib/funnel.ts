/**
 * CUJ funnel vocabulary (02d §9). A closed set of event names so the funnel
 * scoreboard can be wired without renaming later. Emission is a fire-and-forget
 * beacon — analytics must never block or break the money path. The real sink
 * lands with the benchmark scoreboard (Phase 3); until then this posts to the
 * api-server's analytics beacon when configured, and no-ops on the server.
 */

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
  | "subscription_created";

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
  const payload = JSON.stringify({ event, props, ts: Date.now() });
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
