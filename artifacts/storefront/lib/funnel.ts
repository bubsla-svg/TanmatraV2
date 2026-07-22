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
  | "cuj_paid";

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
