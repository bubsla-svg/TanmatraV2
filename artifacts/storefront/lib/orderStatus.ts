/**
 * Order-status client (SF-06 / CUJ-06). One verified endpoint powers both the
 * confirmed screen and the tracker:
 *
 *   GET /api/orders/:externalOrderId/status   (guest — no auth; checkout.ts)
 *   → 200 {orderId, status, timing, etaMinutes, scheduledFor, deliveryWindow}
 *   → 404 {error:"order not found"}
 *
 * `timing` (P0-3, docs/audit/P0-3-SCHEDULE-NOT-COUNTDOWN.md) says which of the
 * other three fields is meaningful — an on-demand order never had a "when",
 * and a scheduled subscription delivery never had a live countdown, so the
 * two must not be conflated the way a single always-present etaMinutes once
 * was:
 *   - "on_demand"  → etaMinutes counts down a 25-min SLA; scheduledFor/
 *                    deliveryWindow are null.
 *   - "scheduled"  → scheduledFor + deliveryWindow are the confirmed delivery
 *                    time; etaMinutes is null — there is nothing to count
 *                    down, the meal has an appointment, not an SLA.
 *   - "pending"    → none of the above are known yet (a scheduled order whose
 *                    schedule hasn't landed). A controlled "we're confirming
 *                    your delivery time" state, never a fabricated countdown.
 *
 * Server components call the api directly (API_BASE_URL); the client island
 * polls same-origin /api via the proxy. Every failure mode maps to an HONEST
 * state — "not found" vs "unavailable" — never a crash, never a fabricated
 * status (§6: degradation is graceful and truthful).
 */

export type OrderTiming = "on_demand" | "scheduled" | "pending";

export interface OrderStatus {
  orderId: string;
  status: string;
  timing: OrderTiming;
  /** Minutes remaining in the on-demand SLA window. Only meaningful when
   *  `timing === "on_demand"`. */
  etaMinutes: number | null;
  /** ISO timestamp of the confirmed delivery. Only meaningful when
   *  `timing === "scheduled"`. */
  scheduledFor: string | null;
  /** e.g. "12:00-14:00". Only meaningful when `timing === "scheduled"`. */
  deliveryWindow: string | null;
}

const ORDER_TIMINGS: ReadonlySet<string> = new Set(["on_demand", "scheduled", "pending"]);

export type OrderStatusResult =
  | { kind: "ok"; status: OrderStatus }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/** Human copy for the server's status strings; unknown values pass through
 *  raw rather than being guessed at. */
const STATUS_LABELS: Record<string, string> = {
  placed: "Order placed",
  preparing: "Being fired in the kitchen",
  ready: "Packed and ready",
  rider_assigned: "Rider assigned",
  dispatched: "Out for delivery",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Payment failed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * In-flight statuses that can be tracked. An ALLOWLIST, not a terminal
 * denylist: new terminal states ("refunded", "failed", …) keep appearing, and
 * an allowlist fails safe by hiding Track for anything it doesn't recognise
 * rather than showing a dead CTA on a settled order. Shared by the order rows
 * and the account hub's live-order card.
 */
export const TRACKABLE_STATUSES: ReadonlySet<string> = new Set([
  "placed",
  "preparing",
  "ready",
  "rider_assigned",
  "out_for_delivery",
]);

/**
 * Terminal statuses where the money did NOT settle. Kept separate from
 * "delivered" because the Stitch brief (route-12) gives them a distinct
 * treatment — danger tone, dimmed card, no reorder CTA.
 */
const UNSETTLED_STATUSES: ReadonlySet<string> = new Set(["cancelled", "refunded", "failed"]);

/**
 * Visual tone for an order row. Three buckets, matching the route-12 brief:
 *   live    — in flight, sage signal + pulse
 *   failed  — money didn't settle, danger tone + dimmed
 *   settled — delivered or anything unrecognised
 *
 * Unknown statuses fall to "settled" deliberately: the same fail-safe reasoning
 * as TRACKABLE_STATUSES, in the other direction. A status we don't recognise
 * must not fabricate liveness (a dead pulse dot) or fabricate alarm (a red
 * "payment failed" on a healthy order) — neutral is the only honest default.
 */
export type OrderTone = "live" | "settled" | "failed";

export function statusTone(status: string): OrderTone {
  if (TRACKABLE_STATUSES.has(status)) return "live";
  if (UNSETTLED_STATUSES.has(status)) return "failed";
  return "settled";
}

export async function fetchOrderStatus(
  externalOrderId: string,
  base: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderStatusResult> {
  try {
    const res = await fetchImpl(
      `${base}/api/orders/${encodeURIComponent(externalOrderId)}/status`,
      { cache: "no-store" },
    );
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) return { kind: "unavailable" };
    const body = (await res.json()) as Partial<OrderStatus>;
    if (typeof body.orderId !== "string" || typeof body.status !== "string") {
      return { kind: "unavailable" };
    }
    // An unrecognised/missing timing falls back to on_demand with whatever
    // etaMinutes came through (or 0) — the well-understood case, never a
    // guessed schedule.
    const timing: OrderTiming =
      typeof body.timing === "string" && ORDER_TIMINGS.has(body.timing)
        ? (body.timing as OrderTiming)
        : "on_demand";
    return {
      kind: "ok",
      status: {
        orderId: body.orderId,
        status: body.status,
        timing,
        etaMinutes: timing === "on_demand"
          ? (typeof body.etaMinutes === "number" ? body.etaMinutes : 0)
          : null,
        scheduledFor: timing === "scheduled" && typeof body.scheduledFor === "string"
          ? body.scheduledFor
          : null,
        deliveryWindow: timing === "scheduled" && typeof body.deliveryWindow === "string"
          ? body.deliveryWindow
          : null,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
