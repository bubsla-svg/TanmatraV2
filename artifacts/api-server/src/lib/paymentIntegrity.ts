// ─────────────────────────────────────────────────────────────────────────────
// Pure payment-integrity decisions (DB-free — unit-testable without Postgres).
//
// The amount a customer is charged, and the amount a webhook is allowed to
// confirm, must both be derived from the server-stored order — never from a
// client-supplied number. These helpers centralise that rule so the UPI
// payment-link path and the Razorpay webhook can't diverge from the already-
// hardened /payments/razorpay/order path.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The authoritative payable amount for an order, in paise. `chargePaise` (the
 * loyalty finalize path) wins over `totalPaise` (the guest-checkout path, which
 * already includes GST + fee). Returns null when neither is a positive integer,
 * so the caller can refuse to create a gateway charge for an unpayable order.
 */
export function resolvePayableAmountPaise(order: {
  chargePaise: number | null;
  totalPaise: number | null;
}): number | null {
  const amount = order.chargePaise ?? order.totalPaise;
  if (amount == null || !Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}

/**
 * Whether a gateway capture may CONFIRM (promote) an order. We confirm only when
 * the captured amount equals the authoritative order amount. When either side is
 * unknown we cannot prove a mismatch, so we defer to the guarded promotion path
 * rather than reject a legitimate payment. A concrete mismatch (both known and
 * unequal) is the underpay/tamper signal — it must NOT confirm and must alarm.
 */
export function isCaptureAmountReconciled(
  expectedPaise: number | null,
  capturedPaise: number | null,
): boolean {
  if (expectedPaise == null || capturedPaise == null) return true;
  return capturedPaise === expectedPaise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Refund authority — how much of an order is still refundable.
//
// The mirror image of the rule above. Charging asks "what may we take from
// this customer"; refunding asks "what may we give back", and the answer has
// the same shape: a number derived from the server-stored order, minus what
// has already gone back, never a number an operator (or an LLM speaking for
// one) supplied.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every `delivery_events.event` name under which money going back to a
 * customer is recorded. There are two, because two paths refund and they were
 * written apart: `routes/refunds.ts` (the real gateway path, driven off a
 * refund_requests row) records `order_refunded`, and the ops agent's
 * `refund_order` tool records `refund_issued`. Both put the amount in
 * `meta.amountPaise`.
 *
 * Two names for one fact is a bug we are not fixing here (renaming an event
 * rewrites history readers), but any code asking "how much has been refunded"
 * must read BOTH or it will confidently answer zero for refunds the other path
 * issued. Read this constant; do not write either string out by hand.
 */
export const REFUND_EVENT_NAMES = ["refund_issued", "order_refunded"] as const;

/**
 * Total already refunded against an order, in paise, summed from its refund
 * events — or **null when that total cannot be established**, because some
 * event in the set carries no readable positive-integer `meta.amountPaise`.
 *
 * Null is not zero, and the difference is the whole point. Skipping an
 * unreadable event would under-count what has already gone back and therefore
 * over-permit what may go back next — a silent fail-open on the exact number
 * the caller is about to trust. An empty list is a genuine zero; an
 * unintelligible one is an unknown, and unknown must reach the caller as such.
 *
 * (This is deliberately the opposite disposition to `isCaptureAmountReconciled`
 * above, which defers when it cannot prove a mismatch. The asymmetry is in the
 * cost of being wrong: refusing an unprovable capture rejects a payment the
 * customer has already made, while refusing an unprovable refund only sends an
 * operator to the refunds console, which is the authoritative path anyway.)
 */
export function refundedSoFarPaise(
  events: ReadonlyArray<{ meta: Record<string, unknown> | null }>,
): number | null {
  let sum = 0;
  for (const event of events) {
    const raw = event.meta?.["amountPaise"];
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
      return null;
    }
    sum += raw;
  }
  return sum;
}

/**
 * How much of `order` may still be refunded, in paise, given the refund events
 * already recorded against it. Null when it cannot be determined — either the
 * order has no resolvable payable amount, or its refund history is unreadable
 * (see above). A null must be refused by the caller, not coerced to a number.
 *
 * Two things this fixes over "cap the refund at the order total":
 *
 *   1. The cap is `resolvePayableAmountPaise` — `chargePaise ?? totalPaise` —
 *      not `totalPaise`. Per the schema, `total_paise` is the meal subtotal
 *      with NO GST and NO delivery fee ("do not use this to charge"), while
 *      `charge_paise` is what was actually billed. Capping a refund at
 *      total_paise on an order that has a charge_paise refuses to return the
 *      customer's GST and delivery fee — money they demonstrably paid. It
 *      fails toward the house, quietly, on every order with a charge_paise
 *      set, which is every order the loyalty finalize path wrote.
 *
 *   2. Prior refunds are subtracted. A cap that only ever compares against the
 *      order total is not a cap on the order, it is a cap on a single call:
 *      the same full-value refund passes it once, twice, five times. Netting
 *      against history is also strictly better than the obvious alternative of
 *      refusing any order already in status `refunded`, because it still
 *      permits a legitimate second partial refund (₹100 now, ₹200 next week)
 *      that a status guard would wrongly block.
 *
 * Clamped at zero: an order somehow refunded past its payable amount has no
 * negative headroom, and a negative "remaining" only exists to be formatted
 * into a confusing message.
 *
 * KNOWN GAP, deliberately out of scope here: a *pending* `refund_requests` row
 * is not counted, because pending money has not moved. A pending request that
 * is later approved could therefore combine with a refund issued here to
 * exceed the order — but the approve path in `routes/refunds.ts` caps nothing
 * against the order at all, so that hole is that path's to close, not this
 * helper's to paper over.
 */
export function remainingRefundablePaise(
  order: { chargePaise: number | null; totalPaise: number | null },
  priorRefundEvents: ReadonlyArray<{ meta: Record<string, unknown> | null }>,
): number | null {
  const payable = resolvePayableAmountPaise(order);
  if (payable == null) return null;
  const already = refundedSoFarPaise(priorRefundEvents);
  if (already == null) return null;
  return Math.max(0, payable - already);
}
