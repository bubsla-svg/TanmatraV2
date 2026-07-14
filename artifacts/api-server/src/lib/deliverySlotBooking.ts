// ─────────────────────────────────────────────────────────────────────────────
// Delivery-window bookability — PURE (no DB), so the à la carte "scheduled slot
// required, no ASAP" rule (Phase B2) is unit-testable without Postgres.
//
// Scheduled à la carte is capacity-controlled and windows-only: an order may
// only reserve a slot whose window has not ended and which still has spare
// capacity. finalizeOrder loads the slot row and gates on this predicate before
// reserving; there is no "deliver now" auto-pick for the scheduled path.
// ─────────────────────────────────────────────────────────────────────────────

export interface BookableSlot {
  endsAt: Date;
  reservedCount: number;
  capacity: number;
}

/** A slot is bookable iff its window hasn't ended and it has spare capacity. */
export function isDeliverySlotBookable(slot: BookableSlot, now: Date): boolean {
  return (
    slot.endsAt.getTime() > now.getTime() &&
    slot.reservedCount < slot.capacity
  );
}
