/**
 * Order-status client (SF-06 / CUJ-06). One verified endpoint powers both the
 * confirmed screen and the tracker:
 *
 *   GET /api/orders/:externalOrderId/status   (guest — no auth; checkout.ts)
 *   → 200 {orderId, status, etaMinutes}       ETA counts down a 25-min SLA
 *   → 404 {error:"order not found"}
 *
 * Server components call the api directly (API_BASE_URL); the client island
 * polls same-origin /api via the proxy. Every failure mode maps to an HONEST
 * state — "not found" vs "unavailable" — never a crash, never a fabricated
 * status (§6: degradation is graceful and truthful).
 */

export interface OrderStatus {
  orderId: string;
  status: string;
  etaMinutes: number;
}

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
    return {
      kind: "ok",
      status: {
        orderId: body.orderId,
        status: body.status,
        etaMinutes: typeof body.etaMinutes === "number" ? body.etaMinutes : 0,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}
