// ─────────────────────────────────────────────────────────────────────────────
// Subscription lifecycle rules (pure, DB-free — unit-testable without Postgres).
//
// The customer-facing promise is "skip/swap up to 24 h before delivery". That
// cutoff was advertised but never enforced server-side. This module holds the
// single source of truth for the cutoff so the server enforces exactly what the
// UI promises (and the UI can import the same constant when it disables the
// control inside the window).
// ─────────────────────────────────────────────────────────────────────────────

/** Skip / swap must happen at least this long before the delivery's scheduled time. */
export const SKIP_SWAP_CUTOFF_MS = 24 * 60 * 60 * 1000;

/**
 * True when a delivery is inside the cutoff window (too close to its scheduled
 * time to skip or swap). A delivery already in the past is also "past cutoff".
 * `now` is injectable for tests.
 */
export function isPastSkipCutoff(
  scheduledFor: Date | string | number,
  now: number = Date.now(),
): boolean {
  const t =
    scheduledFor instanceof Date
      ? scheduledFor.getTime()
      : new Date(scheduledFor).getTime();
  if (Number.isNaN(t)) return false; // unknown schedule → don't block on a bad value
  return t - now < SKIP_SWAP_CUTOFF_MS;
}
