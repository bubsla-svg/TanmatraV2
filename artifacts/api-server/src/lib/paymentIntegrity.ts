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
