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

/**
 * THE ONE OPERATIONAL TIMEZONE. Every human-facing delivery time is expressed
 * in it, and nothing anywhere reads a client's timezone to decide anything.
 *
 * Eligibility itself is timezone-free: `startsAt`/`expiresAt` are `timestamptz`
 * and the cutoff is arithmetic on absolute instants, so a server in UTC and a
 * server in IST admit exactly the same slots. This constant governs only how an
 * instant is RENDERED into a window label — but that label is also what the
 * customer picks and what save-time validation matches against, so it has to be
 * pinned to one zone rather than to whatever `TZ` the container happens to run
 * with. Asia/Kolkata observes no DST, so the offset is a constant +05:30 and
 * there is no ambiguous or skipped local hour to resolve.
 *
 * `delivery_slots.slot_date` is the operational date and must be written in
 * THIS zone by whoever publishes slots; the eligibility query groups by it
 * verbatim rather than re-deriving a date from the instant.
 */
export const DELIVERY_OPERATIONAL_TZ = "Asia/Kolkata";

/** h23 explicitly: `hour12:false` alone renders midnight as "24:00" in some
 *  locales, which would make a midnight window's label unstable. */
const WINDOW_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: DELIVERY_OPERATIONAL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

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

/** Formats a slot's window label in the operational timezone. One place, so the
 *  label a customer picks is byte-identical to the one validated on save. */
export function windowLabel(slot: {
  startsAt: Date;
  endsAt: Date;
}): string {
  return `${WINDOW_TIME_FORMAT.format(slot.startsAt)}-${WINDOW_TIME_FORMAT.format(slot.endsAt)}`;
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

export interface ScheduleSlotResolution {
  /** One slot id per scheduled day, in lineup order. */
  slotIds: number[];
  /** Days whose (date, window) no longer names a published slot. */
  unresolved: { deliveryDate: string; deliveryWindow: string }[];
}

/**
 * Resolve a draft's scheduled days back to the slot rows they name.
 *
 * DELIBERATELY NOT VIA `eligibleDates()`. That function is the OFFER list, and
 * it hides slots with no capacity left — correct for "what may the customer
 * still pick", catastrophic for "which rows must I reserve". Resolving through
 * it meant a slot that filled between readiness and issue simply vanished from
 * the lookup, the caller reserved nothing, and the quote was issued holding NO
 * capacity at all: two customers could each be sold the last unit and both be
 * told yes. (That is DEFECT-PLAN-CAPACITY-002; the A2.3 overbooking test failed
 * roughly two runs in three because of it.)
 *
 * So resolution asks only "does this (date, window) name a published slot in
 * this zone", and CAPACITY IS DECIDED IN EXACTLY ONE PLACE — the conditional
 * increment in `reserveSlotsForQuote`. A full slot resolves fine here and is
 * refused there, which is the only ordering that cannot silently under-reserve.
 */
export async function resolveScheduleSlots(
  days: readonly { deliveryDate: string; deliveryWindow: string | null }[],
  zone: string,
): Promise<ScheduleSlotResolution> {
  const slotIds: number[] = [];
  const unresolved: { deliveryDate: string; deliveryWindow: string }[] = [];

  const dates = Array.from(new Set(days.map((d) => d.deliveryDate).filter(Boolean)));
  const slots =
    dates.length === 0
      ? []
      : await db
          .select()
          .from(deliverySlotsTable)
          .where(
            and(
              eq(deliverySlotsTable.zone, zone),
              inArray(deliverySlotsTable.slotDate, dates),
            ),
          );

  const byKey = new Map(slots.map((s) => [`${s.slotDate}:${windowLabel(s)}`, s.id]));
  for (const day of days) {
    const window = day.deliveryWindow ?? "";
    const id = byKey.get(`${day.deliveryDate}:${window}`);
    if (id == null) {
      unresolved.push({ deliveryDate: day.deliveryDate, deliveryWindow: window });
      continue;
    }
    slotIds.push(id);
  }
  return { slotIds, unresolved };
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
          // Only a LIVE reservation counts as already-held. A released or
          // consumed row is not capacity this call still owns.
          eq(slotReservationsTable.status, "active"),
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

/**
 * Give back every unit of capacity a quote is still holding, EXACTLY ONCE.
 *
 * Five paths can race to release the same reservation — the expiry sweeper, a
 * draft edit, a reschedule, quote supersession, and a rollback — so "released
 * at most once" cannot rest on the caller being careful. The guard is the
 * transition itself: the `active → released` UPDATE is what CLAIMS the row, and
 * only rows this call actually claimed are decremented. N concurrent releasers
 * therefore decrement once between them, not N times.
 *
 * A `consumed` reservation is invisible to this function by construction. Once
 * an order owns the capacity (A2.4), a late sweeper must not hand it back — the
 * kitchen would then take another booking against a slot it has already sold.
 */
export async function releaseSlotsForQuote(
  tx: DbExecutor,
  quoteId: string,
  now: Date = new Date(),
): Promise<number> {
  const claimed = await tx
    .update(slotReservationsTable)
    .set({ status: "released", releasedAt: now })
    .where(
      and(
        eq(slotReservationsTable.planDraftQuoteId, quoteId),
        eq(slotReservationsTable.status, "active"),
      ),
    )
    .returning({ slotId: slotReservationsTable.slotId });

  for (const { slotId } of claimed) {
    await tx
      .update(deliverySlotsTable)
      .set({
        // Floor at zero: a decrement must never drive the counter negative
        // even if operations edited capacity underneath us.
        reservedCount: sql`greatest(${deliverySlotsTable.reservedCount} - 1, 0)`,
      })
      .where(eq(deliverySlotsTable.id, slotId));
  }
  return claimed.length;
}

/**
 * Hand a quote's held capacity to the order that settled it (A2.4).
 *
 * Deliberately does NOT decrement `reservedCount`: the units stay held, they
 * just change owner from "a quote someone might pay" to "an order someone did".
 * Marking them `consumed` is also what makes them permanently unreleasable —
 * see `releaseSlotsForQuote`.
 */
export async function consumeSlotsForQuote(
  tx: DbExecutor,
  quoteId: string,
): Promise<number> {
  const claimed = await tx
    .update(slotReservationsTable)
    .set({ status: "consumed" })
    .where(
      and(
        eq(slotReservationsTable.planDraftQuoteId, quoteId),
        eq(slotReservationsTable.status, "active"),
      ),
    )
    .returning({ slotId: slotReservationsTable.slotId });
  return claimed.length;
}

/** Supersede active quotes for a draft inside a caller's transaction, so an
 *  issue path can supersede-then-insert atomically rather than leaving a window
 *  where the draft holds no quote and another request can slip in. */
export async function supersedeActiveQuotesTx(
  tx: DbExecutor,
  draftId: string,
  reason: "superseded" | "expired" = "superseded",
  now: Date = new Date(),
): Promise<number> {
  // Claim-then-act: the guarded UPDATE is what wins the quote, so a quote being
  // consumed concurrently (A2.4) is never silently overwritten back to
  // superseded, and its capacity is never released out from under the order.
  const claimed = await tx
    .update(planDraftQuotesTable)
    .set({ status: reason })
    .where(
      and(
        eq(planDraftQuotesTable.planDraftId, draftId),
        eq(planDraftQuotesTable.status, "active"),
      ),
    )
    .returning({ id: planDraftQuotesTable.id });

  for (const q of claimed) {
    await releaseSlotsForQuote(tx, q.id, now);
  }
  return claimed.length;
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
  now: Date = new Date(),
): Promise<number> {
  return db.transaction((tx) => supersedeActiveQuotesTx(tx, draftId, reason, now));
}

/**
 * Expire quotes past their TTL and give their capacity back. Driven by the
 * plan-draft maintenance sweep.
 *
 * The sweep is the CLEANUP path, never the correctness path: `activeQuoteFor`
 * filters on `expiresAt` at read time and `consumeQuote` refuses an expired
 * quote from server time, so a quote is unpayable the instant it lapses whether
 * or not this has run.
 */
export async function expireLapsedQuotes(now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(planDraftQuotesTable)
      .set({ status: "expired" })
      .where(
        and(
          eq(planDraftQuotesTable.status, "active"),
          lt(planDraftQuotesTable.expiresAt, now),
        ),
      )
      .returning({ id: planDraftQuotesTable.id });

    for (const q of claimed) {
      await releaseSlotsForQuote(tx, q.id, now);
    }
    return claimed.length;
  });
}

export type QuoteConsumeRefusal =
  /** No quote with that id. */
  | "not_found"
  /** Already superseded, expired or consumed — a second settlement attempt
   *  against one quote must not produce a second order. */
  | "not_active"
  /** Past its TTL by SERVER time, regardless of whether the sweeper has run. */
  | "expired";

export interface QuoteConsumeResult {
  ok: boolean;
  refusal: QuoteConsumeRefusal | null;
  quote: typeof planDraftQuotesTable.$inferSelect | null;
  reservationsConsumed: number;
}

/**
 * The A2.4 seam: claim a quote for settlement, exactly once.
 *
 * A2.4 owns everything downstream (PaymentAttempt → Order → Subscription →
 * first cycle → deliveries); this is only the guard in front of it, and it
 * lives here because it is the other half of the release invariant above —
 * "consumed capacity is never released" is meaningless without a consumer.
 *
 * `status = 'active' AND expires_at >= now` is evaluated INSIDE the claiming
 * UPDATE, so an expired or already-consumed quote cannot produce a payment
 * attempt even under a retried webhook: only the first caller sees `ok`.
 */
export async function consumeQuote(
  quoteId: string,
  now: Date = new Date(),
): Promise<QuoteConsumeResult> {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(planDraftQuotesTable)
      .set({ status: "consumed" })
      .where(
        and(
          eq(planDraftQuotesTable.id, quoteId),
          eq(planDraftQuotesTable.status, "active"),
          gte(planDraftQuotesTable.expiresAt, now),
        ),
      )
      .returning();

    if (claimed) {
      const reservationsConsumed = await consumeSlotsForQuote(tx, quoteId);
      return { ok: true, refusal: null, quote: claimed, reservationsConsumed };
    }

    // Nothing claimed — say precisely why, so the caller can tell "someone
    // else already settled this" from "this lapsed, re-quote".
    const [existing] = await tx
      .select()
      .from(planDraftQuotesTable)
      .where(eq(planDraftQuotesTable.id, quoteId));
    const refusal: QuoteConsumeRefusal = !existing
      ? "not_found"
      : existing.status !== "active"
        ? "not_active"
        : "expired";
    return {
      ok: false,
      refusal,
      quote: existing ?? null,
      reservationsConsumed: 0,
    };
  });
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
