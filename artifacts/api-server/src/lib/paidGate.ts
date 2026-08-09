/**
 * The paid-fulfilment invariant (docs/MONEY-PATH-VERIFICATION.md §5, owner
 * acceptance criterion): no order may become operationally actionable until
 * payment success or verified zero-charge settlement is authoritative on the
 * server.
 *
 * For own_app orders, `status = "placed"` IS the pre-payment state: the
 * placed→preparing edge is reserved for the payment-capture writers
 * (routes/payments.ts verify + webhooks, lib/reconciliationScheduler.ts) and
 * the zero-charge finalize (lib/loyaltyEngine.ts, routes/subscriptions.ts —
 * credits/subsidy settled in the same transaction). Everything else must
 * refuse to act on a "placed" row, fail-closed: statuses not listed below
 * (placed, failed, cancelled, billed, out-of-vocabulary values) are refused
 * by every guard that imports this module.
 *
 * Two predicates, deliberately distinct — collapsing them was a reviewed-out
 * bug (it broke packing and rider reassignment for paid in-flight orders):
 *
 * - ASSIGNABLE: may this order consume a rider for a FIRST assignment?
 *   Only "preparing"/"ready" — a row in "rider_assigned"/"out_for_delivery"
 *   already has one (though not every assignment path refuses on rider_id:
 *   the ops agent's assign_rider is a deliberate reassignment tool, and
 *   dispatch's overrideAssignment is the status-free human escape hatch —
 *   both are gated on paid-liveness, never on assignability).
 *
 * - PAID-LIVE: has payment resolved and is the order still in flight?
 *   Includes rider-carrying statuses — packing (WMS route-fulfillment, BOM
 *   explosion) and rider REassignment legitimately happen after a rider is
 *   attached. Excludes "billed" (mandate settlement ledger rows, fulfilled
 *   via the POS push, never via these surfaces) and every terminal state.
 */

export const FULFILMENT_ASSIGNABLE_STATUSES = ["preparing", "ready"] as const;

export const PAID_LIVE_STATUSES = [
  "preparing",
  "ready",
  "rider_assigned",
  "out_for_delivery",
] as const;

/** First-time rider assignment + KDS/dispatch scan eligibility. */
export function isFulfilmentAssignable(status: string): boolean {
  return (FULFILMENT_ASSIGNABLE_STATUSES as readonly string[]).includes(status);
}

/** Payment resolved and still in flight — packing, inventory deduction,
 *  rider reassignment, tracking. */
export function isPaidLive(status: string): boolean {
  return (PAID_LIVE_STATUSES as readonly string[]).includes(status);
}
