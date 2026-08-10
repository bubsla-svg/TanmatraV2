import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Reservable delivery time-windows. capacity is the max number of orders the
// kitchen + rider pool can handle in this window for the given zone; the
// reservedCount column is incremented atomically on checkout.
export const deliverySlotsTable = pgTable(
  "delivery_slots",
  {
    id: serial("id").primaryKey(),
    slotDate: date("slot_date").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    zone: varchar("zone", { length: 64 }).notNull().default("default"),
    capacity: integer("capacity").notNull().default(20),
    reservedCount: integer("reserved_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_delivery_slot_zone_window").on(
      table.zone,
      table.startsAt,
      table.endsAt,
    ),
  ],
);

/**
 * A reservation's lifecycle (A2.3a). Explicit, because "how many times has this
 * reservation given its capacity back?" must be answerable — a plain DELETE
 * cannot distinguish *released* from *never existed*, and cannot stop a
 * reservation that an order now legitimately holds from being released by a
 * sweeper that arrives late.
 *
 * Transitions are one-way and guarded (see `releaseSlotsForQuote` /
 * `consumeSlotsForQuote`): the capacity decrement happens ONLY when the guarded
 * `active → released` UPDATE actually claims the row, so N concurrent releasers
 * decrement exactly once between them.
 */
export type SlotReservationStatus =
  /** Holding one unit of the parent slot's capacity. */
  | "active"
  /** Settled into an order/subscription (A2.4). Terminal, and deliberately
   *  NOT releasable — the capacity is still held, it just changed owner. */
  | "consumed"
  /** Gave its unit back exactly once. Terminal. */
  | "released";

// Reservations are 1:1 with the thing holding the slot. We enforce that
// uniqueness with partial unique indexes so retried writes can't double-
// reserve and inflate the parent slot's reservedCount.
export const slotReservationsTable = pgTable(
  "slot_reservations",
  {
    id: serial("id").primaryKey(),
    slotId: integer("slot_id")
      .notNull()
      .references(() => deliverySlotsTable.id),
    userId: varchar("user_id"),
    orderId: integer("order_id"),
    subscriptionId: integer("subscription_id"),
    /** A pre-purchase PlanDraft quote holding capacity (A2.3). Bounded by the
     *  quote's own expiry — unlike an order reservation, this one is released
     *  if the customer never pays. */
    planDraftQuoteId: varchar("plan_draft_quote_id"),
    kind: varchar("kind", { length: 32 }).notNull().default("order"),
    /** See SlotReservationStatus. Pre-A2.3a rows are `active`, which is what
     *  they were: rows existed exactly while the capacity was held. */
    status: varchar("status", { length: 16 })
      .$type<SlotReservationStatus>()
      .notNull()
      .default("active"),
    /** When the row left `active`. Null while held. Audit only — the guard is
     *  the status transition, not this column. */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_slot_reservation_order")
      .on(table.orderId)
      .where(sql`${table.orderId} is not null`),
    uniqueIndex("uniq_slot_reservation_subscription")
      .on(table.subscriptionId)
      .where(sql`${table.subscriptionId} is not null`),
    // One reservation per (quote, slot): a retried reserve call must not
    // inflate the parent slot's reservedCount.
    uniqueIndex("uniq_slot_reservation_plan_draft_quote")
      .on(table.planDraftQuoteId, table.slotId)
      .where(sql`${table.planDraftQuoteId} is not null`),
    // The release sweep scans by status; without this it seq-scans a table
    // that only ever grows (rows are now retained, not deleted).
    index("idx_slot_reservations_status").on(table.status),
  ],
);

export type DeliverySlot = typeof deliverySlotsTable.$inferSelect;
export type SlotReservation = typeof slotReservationsTable.$inferSelect;
