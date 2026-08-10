import {
  pgTable,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { planDraftsTable } from "./planDrafts";

// ─────────────────────────────────────────────────────────────────────────────
// The record of a PlanDraft becoming a live subscription (A2.4).
//
// It exists to make the origination invariants DATABASE FACTS rather than
// things the application promises:
//
//     one settled QuoteSnapshot → exactly one Order
//                               → exactly one Subscription
//                               → exactly one first cycle of deliveries
//
// `plan_draft_quote_id` is UNIQUE. That single constraint is what makes a
// repeated payment callback, a double-clicked button and a retried webhook all
// converge on one subscription: the second writer's INSERT fails, and the
// handler answers with the conversion that already exists instead of building
// a second one. `consumeQuote` guards the same thing from the quote's side;
// having both means neither is load-bearing alone.
//
// It is also the replay record. A conversion is not idempotent by being
// retryable — it is idempotent because the answer is stored and returned again.
// ─────────────────────────────────────────────────────────────────────────────

/** How the money was settled. */
export type PlanDraftSettlementKind =
  /** A verified Razorpay capture bound to this quote's payment attempt. */
  | "razorpay"
  /** Nothing was payable — credits covered the whole quoted total. The
   *  server's own credit arithmetic is the evidence; a client claiming ₹0 is
   *  not, which is why the amount is recomputed rather than accepted. */
  | "zero_charge";

export const planDraftConversionsTable = pgTable(
  "plan_draft_conversions",
  {
    id: varchar("id").primaryKey(),
    planDraftId: varchar("plan_draft_id")
      .notNull()
      .references(() => planDraftsTable.id, { onDelete: "cascade" }),
    /** UNIQUE — see the header. One quote can become at most one subscription. */
    planDraftQuoteId: varchar("plan_draft_quote_id").notNull(),
    /** Who bought it. Part of the idempotency identity so one customer's retry
     *  token can never resolve to another customer's conversion. */
    userId: varchar("user_id").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),

    subscriptionId: integer("subscription_id").notNull(),
    orderId: integer("order_id").notNull(),

    settlementKind: varchar("settlement_kind", { length: 16 })
      .$type<PlanDraftSettlementKind>()
      .notNull(),
    /** Gateway reference for audit — the Razorpay payment id, or null for a
     *  zero-charge settlement. */
    settlementRef: varchar("settlement_ref", { length: 128 }),
    /** What was actually settled, in paise. Server-computed from the frozen
     *  quote; recorded so a later reconciliation can prove the amount charged
     *  equalled the amount quoted. */
    settledPaise: integer("settled_paise").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // THE invariant. Deliberately a plain unique index, not partial: there is
    // no status under which a second conversion of one quote is acceptable.
    uniqueIndex("uniq_plan_draft_conversion_quote").on(table.planDraftQuoteId),
    // Replay lookup, scoped to the owner so a guessed key discloses nothing.
    uniqueIndex("uniq_plan_draft_conversion_idempotency")
      .on(table.userId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("idx_plan_draft_conversions_draft").on(table.planDraftId),
    index("idx_plan_draft_conversions_subscription").on(table.subscriptionId),
  ],
);

export type PlanDraftConversion = typeof planDraftConversionsTable.$inferSelect;
