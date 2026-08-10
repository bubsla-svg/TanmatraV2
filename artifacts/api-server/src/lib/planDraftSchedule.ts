import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  deliverySlotsTable,
  planDraftsTable,
  planDraftQuotesTable,
  slotReservationsTable,
  userAddressesTable,
  type DeliverySlot,
  type PlanDraft,
  type PlanDraftDay,
} from "@workspace/db";
import { isServiceablePincode } from "@workspace/api-zod";

// ─────────────────────────────────────────────────────────────────────────────
// Delivery eligibility, capacity and scheduling for a PlanDraft (PR A2.3).
//
// Everything a customer could otherwise guess at client-side is decided here:
// which dates are offerable, which windows exist on them, whether the address
// can be served at all, and whether there is capacity. The frontend renders
// what this returns and nothing else — it must never generate a date, a window
// or a fee of its own.
//
// CLOSURES AND HOLIDAYS are modelled as the ABSENCE OF SLOTS rather than as a
// separate calendar table. A day the kitchen does not run simply has no
// `delivery_slots` rows for the zone, so it never appears as eligible. That is
// the honest reading of the existing schema — inventing a holidays table would
// add a second source of truth that operations would have to keep in sync with
// the slots they already publish.
// ─────────────────────────────────────────────────────────────────────────────

/** A slot must be this far in the future to be bookable. Matches the 24h
 *  skip/swap/reschedule cutoff the subscription routes already advertise —
 *  inside that window the delivery is committed to the kitchen. */
export const DELIVERY_CUTOFF_MS = 24 * 60 * 60 * 1000;

/** How long an issued quote (and the capacity it holds) stays valid. */
export const QUOTE_TTL_MS = 30 * 60 * 1000;

/** Either the pool or an open transaction. Reservation helpers take this so a
 *  caller can run them inside the same transaction as the quote insert without
 *  casting the transaction to the pool type. */
export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ServiceabilityFailure =
  | "no_address"
  | "address_not_found"
  | "pincode_not_serviceable";

export interface ServiceabilityResult {
  ok: boolean;
  failure: ServiceabilityFailure | null;
  /** Customer-safe explanation. Never leaks internals. */
  message: string | null;
  /** What the customer can actually do about it. */
  recovery: string[];
  addressId: number | null;
  pincode: string | null;
  /** The fulfilment zone serving this address — the key `delivery_slots` are
   *  published under. Today every serviceable pincode maps to the single
   *  "default" zone the slot table ships with; the seam exists so adding a
   *  second kitchen is a mapping change, not a schema change. */
  zone: string | null;
}

export async function resolveServiceability(
  addressId: number | null,
): Promise<ServiceabilityResult> {
  if (addressId == null) {
    return {
      ok: false,
      failure: "no_address",
      message: "Choose a delivery address to see available dates.",
      recovery: ["add_address"],
      addressId: null,
      pincode: null,
      zone: null,
    };
  }

  const [address] = await db
    .select()
    .from(userAddressesTable)
    .where(eq(userAddressesTable.id, addressId));

  if (!address) {
    return {
      ok: false,
      failure: "address_not_found",
      message: "That delivery address is no longer available.",
      recovery: ["choose_another_address", "add_address"],
      addressId,
      pincode: null,
      zone: null,
    };
  }

  if (!isServiceablePincode(address.pincode)) {
    return {
      ok: false,
      failure: "pincode_not_serviceable",
      // Says what is true without implying it will change on its own.
      message: `We don't deliver to ${address.pincode} yet.`,
      recovery: ["choose_another_address", "join_waitlist"],
      addressId,
      pincode: address.pincode,
      zone: null,
    };
  }

  return {
    ok: true,
    failure: null,
    message: null,
    recovery: [],
    addressId,
    pincode: address.pincode,
    zone: zoneForPincode(address.pincode),
  };
}

/** Single serving zone today — see ServiceabilityResult.zone. */
export function zoneForPincode(_pincode: string): string {
  return "default";
}

export interface DeliveryWindowOption {
  slotId: number;
  /** Stable label the customer picks and the schedule stores. */
  deliveryWindow: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservedCount: number;
  remaining: number;
  /** Advisory only during configuration: capacity is not held until a quote
   *  is issued, so this can change under the customer. Saying so is the point
   *  — the alternative is holding kitchen capacity for every browser. */
  advisory: true;
}

export interface EligibleDate {
  deliveryDate: string;
  windows: DeliveryWindowOption[];
}

/** Formats a slot's window label. One place, so the label a customer picks is
 *  byte-identical to the one validated on save. */
export function windowLabel(slot: DeliverySlot): string {
  const fmt = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${fmt(slot.startsAt)}-${fmt(slot.endsAt)}`;
}

/**
 * Server-generated eligible dates and windows for a zone.
 *
 * Filters, in order: the zone publishes the slot at all (closure handling),
 * the slot starts after the cutoff, and it has capacity left.
 */
export async function eligibleDates(
  zone: string,
  opts: { now?: Date; horizonDays?: number } = {},
): Promise<EligibleDate[]> {
  const now = opts.now ?? new Date();
  const earliest = new Date(now.getTime() + DELIVERY_CUTOFF_MS);
  const horizon = new Date(
    now.getTime() + (opts.horizonDays ?? 120) * 24 * 60 * 60 * 1000,
  );

  const slots = await db
    .select()
    .from(deliverySlotsTable)
    .where(
      and(
        eq(deliverySlotsTable.zone, zone),
        gte(deliverySlotsTable.startsAt, earliest),
        lt(deliverySlotsTable.startsAt, horizon),
      ),
    )
    .orderBy(deliverySlotsTable.startsAt);

  const byDate = new Map<string, DeliveryWindowOption[]>();
  for (const slot of slots) {
    const remaining = slot.capacity - slot.reservedCount;
    if (remaining <= 0) continue; // full — not offerable
    const list = byDate.get(slot.slotDate) ?? [];
    list.push({
      slotId: slot.id,
      deliveryWindow: windowLabel(slot),
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      reservedCount: slot.reservedCount,
      remaining,
      advisory: true,
    });
    byDate.set(slot.slotDate, list);
  }

  return Array.from(byDate.entries())
    .map(([deliveryDate, windows]) => ({ deliveryDate, windows }))
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
}

export type ScheduleValidationCode =
  | "no_lineup"
  | "day_count_mismatch"
  | "duplicate_delivery_slot"
  | "date_not_eligible"
  | "window_not_eligible"
  | "slot_full";

export interface ScheduleValidationIssue {
  code: ScheduleValidationCode;
  message: string;
  deliveryDate?: string;
  deliveryWindow?: string;
}

export interface ScheduleAssignment {
  deliveryDate: string;
  deliveryWindow: string;
  slotId: number;
}

/**
 * Validate a proposed schedule against the draft's lineup and the live slot
 * table. Pure-ish: reads eligibility, writes nothing.
 *
 * Every assignment must land on a date+window the server itself offered, and
 * the plan's own day count must be covered exactly — a lineup with 5 days
 * cannot be scheduled onto 4 dates, and two of its days cannot share one slot
 * (that would silently halve the deliveries the customer is paying for).
 */
export async function validateSchedule(
  draft: PlanDraft,
  assignments: readonly ScheduleAssignment[],
  zone: string,
  now: Date = new Date(),
): Promise<{ ok: boolean; issues: ScheduleValidationIssue[] }> {
  const issues: ScheduleValidationIssue[] = [];
  const lineup = draft.lineup ?? [];
  if (lineup.length === 0) {
    return {
      ok: false,
      issues: [
        {
          code: "no_lineup",
          message: "This plan has no meals to schedule yet.",
        },
      ],
    };
  }

  if (assignments.length !== lineup.length) {
    issues.push({
      code: "day_count_mismatch",
      message: `This plan needs ${lineup.length} delivery days; ${assignments.length} were provided.`,
    });
  }

  const seenSlots = new Set<number>();
  const seenDates = new Set<string>();
  for (const a of assignments) {
    const slotKey = a.slotId;
    if (seenSlots.has(slotKey) || seenDates.has(a.deliveryDate)) {
      issues.push({
        code: "duplicate_delivery_slot",
        message: "Each delivery day needs its own date and time window.",
        deliveryDate: a.deliveryDate,
        deliveryWindow: a.deliveryWindow,
      });
    }
    seenSlots.add(slotKey);
    seenDates.add(a.deliveryDate);
  }

  const eligible = await eligibleDates(zone, { now });
  const byDate = new Map(eligible.map((e) => [e.deliveryDate, e.windows]));

  for (const a of assignments) {
    const windows = byDate.get(a.deliveryDate);
    if (!windows) {
      issues.push({
        code: "date_not_eligible",
        message: `${a.deliveryDate} is not available for delivery.`,
        deliveryDate: a.deliveryDate,
      });
      continue;
    }
    const match = windows.find(
      (w) => w.slotId === a.slotId && w.deliveryWindow === a.deliveryWindow,
    );
    if (!match) {
      issues.push({
        code: "window_not_eligible",
        message: `${a.deliveryWindow} is not available on ${a.deliveryDate}.`,
        deliveryDate: a.deliveryDate,
        deliveryWindow: a.deliveryWindow,
      });
      continue;
    }
    if (match.remaining <= 0) {
      issues.push({
        code: "slot_full",
        message: `${a.deliveryWindow} on ${a.deliveryDate} just filled up.`,
        deliveryDate: a.deliveryDate,
        deliveryWindow: a.deliveryWindow,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

/** Applies a validated schedule onto the lineup, immutably. */
export function withScheduleApplied(
  lineup: readonly PlanDraftDay[],
  assignments: readonly ScheduleAssignment[],
  addressId: number,
): PlanDraftDay[] {
  return lineup.map((day, i) => {
    const a = assignments[i];
    if (!a) return day;
    return {
      ...day,
      deliveryDate: a.deliveryDate,
      deliveryWindow: a.deliveryWindow,
      addressId,
    };
  });
}

// ── Capacity reservation ─────────────────────────────────────────────────────

/**
 * Reserve one unit of capacity per slot for a quote.
 *
 * Atomic and non-overbooking by construction: the increment is conditional on
 * `reserved_count < capacity` IN THE UPDATE, so two concurrent reservers on the
 * last unit cannot both succeed. Idempotent: the partial unique index on
 * (plan_draft_quote_id, slot_id) means a retry inserts nothing and does not
 * re-increment.
 *
 * Returns the slot ids actually reserved; a caller that gets fewer than it
 * asked for must roll back (the quote route does, in the same transaction).
 */
export async function reserveSlotsForQuote(
  tx: DbExecutor,
  quoteId: string,
  slotIds: readonly number[],
  userId: string | null,
): Promise<{ reserved: number[]; failed: number[] }> {
  const reserved: number[] = [];
  const failed: number[] = [];

  for (const slotId of slotIds) {
    const existing = await tx
      .select({ id: slotReservationsTable.id })
      .from(slotReservationsTable)
      .where(
        and(
          eq(slotReservationsTable.planDraftQuoteId, quoteId),
          eq(slotReservationsTable.slotId, slotId),
        ),
      );
    if (existing.length > 0) {
      reserved.push(slotId); // already held by this quote — idempotent
      continue;
    }

    const bumped = await tx
      .update(deliverySlotsTable)
      .set({ reservedCount: sql`${deliverySlotsTable.reservedCount} + 1` })
      .where(
        and(
          eq(deliverySlotsTable.id, slotId),
          lt(deliverySlotsTable.reservedCount, deliverySlotsTable.capacity),
        ),
      )
      .returning({ id: deliverySlotsTable.id });

    if (bumped.length === 0) {
      failed.push(slotId);
      continue;
    }

    await tx.insert(slotReservationsTable).values({
      slotId,
      userId,
      planDraftQuoteId: quoteId,
      kind: "plan_draft_quote",
    });
    reserved.push(slotId);
  }

  return { reserved, failed };
}

/** Release every slot a quote holds. Safe to call twice — it only decrements
 *  for reservation rows that still exist, and deletes them in the same step. */
export async function releaseSlotsForQuote(
  tx: DbExecutor,
  quoteId: string,
): Promise<number> {
  const rows = await tx
    .delete(slotReservationsTable)
    .where(eq(slotReservationsTable.planDraftQuoteId, quoteId))
    .returning({ slotId: slotReservationsTable.slotId });

  for (const { slotId } of rows) {
    await tx
      .update(deliverySlotsTable)
      .set({
        // Floor at zero: a decrement must never drive the counter negative
        // even if operations edited capacity underneath us.
        reservedCount: sql`greatest(${deliverySlotsTable.reservedCount} - 1, 0)`,
      })
      .where(eq(deliverySlotsTable.id, slotId));
  }
  return rows.length;
}

/**
 * Supersede every active quote for a draft and release the capacity they held.
 * Called on any edit that invalidates a quote — a reschedule, a lineup change,
 * a preference change. A quote priced a plan that no longer exists; keeping it
 * payable is how a customer ends up charged for something they changed.
 */
export async function supersedeActiveQuotes(
  draftId: string,
  reason: "superseded" | "expired" = "superseded",
): Promise<number> {
  return db.transaction(async (tx) => {
    const active = await tx
      .select({ id: planDraftQuotesTable.id })
      .from(planDraftQuotesTable)
      .where(
        and(
          eq(planDraftQuotesTable.planDraftId, draftId),
          eq(planDraftQuotesTable.status, "active"),
        ),
      );
    if (active.length === 0) return 0;

    for (const q of active) {
      await releaseSlotsForQuote(tx, q.id);
    }
    await tx
      .update(planDraftQuotesTable)
      .set({ status: reason })
      .where(
        inArray(
          planDraftQuotesTable.id,
          active.map((q) => q.id),
        ),
      );
    return active.length;
  });
}

/** Expire quotes past their TTL and give their capacity back. Driven by the
 *  plan-draft maintenance sweep. */
export async function expireLapsedQuotes(now: Date = new Date()): Promise<number> {
  const lapsed = await db
    .select({ id: planDraftQuotesTable.id })
    .from(planDraftQuotesTable)
    .where(
      and(
        eq(planDraftQuotesTable.status, "active"),
        lt(planDraftQuotesTable.expiresAt, now),
      ),
    );
  if (lapsed.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const q of lapsed) {
      await releaseSlotsForQuote(tx, q.id);
    }
    await tx
      .update(planDraftQuotesTable)
      .set({ status: "expired" })
      .where(
        inArray(
          planDraftQuotesTable.id,
          lapsed.map((q) => q.id),
        ),
      );
  });
  return lapsed.length;
}

/** The draft's current active, non-lapsed quote, if any. */
export async function activeQuoteFor(
  draftId: string,
  now: Date = new Date(),
): Promise<typeof planDraftQuotesTable.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(planDraftQuotesTable)
    .where(
      and(
        eq(planDraftQuotesTable.planDraftId, draftId),
        eq(planDraftQuotesTable.status, "active"),
        gte(planDraftQuotesTable.expiresAt, now),
      ),
    );
  return row ?? null;
}

/** Marks a draft's schedule fields. Kept here so the route layer never has to
 *  know the column names. */
export function scheduleColumnsFor(
  assignments: readonly ScheduleAssignment[],
  addressId: number,
  deliveryFeePaise: number,
): Partial<typeof planDraftsTable.$inferInsert> {
  const first = assignments[0];
  return {
    deliverySchedule: {
      addressId,
      deliveryWindow: first?.deliveryWindow ?? "",
      deliveryFeePaise,
    },
  };
}
