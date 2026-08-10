import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { planDraftsTable } from "./planDrafts";

// ─────────────────────────────────────────────────────────────────────────────
// QuoteSnapshot for a PlanDraft (PR A2.3).
//
// A quote is the server's PRICED, SCHEDULED, POINT-IN-TIME answer for one
// specific version of one draft. It is deliberately a separate row rather than
// more columns on the draft, because the two have different lifetimes and
// different authority:
//
//   • the draft keeps changing while the customer configures it;
//   • a quote must NOT change once issued — it is what the customer was shown
//     and what a payment (A2.4) will be settled against.
//
// `planDraftVersion` is the binding. A quote is only valid for the draft
// version it priced; any subsequent edit supersedes it (see the A2.3 schedule
// routes), so a customer can never pay against a plan they have since altered.
// That is the upstream half of the "one successful settlement → one order →
// one subscription" invariant A2.4 has to hold.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanDraftQuoteStatus =
  /** Current and payable. At most one per draft. */
  | "active"
  /** The draft moved on (an edit, a reschedule) — this quote priced a plan
   *  that no longer exists. */
  | "superseded"
  /** Aged out without being consumed; any capacity it held is released. */
  | "expired"
  /** Settled into an order/subscription (A2.4). Terminal. */
  | "consumed";

/** One priced row of the quote. Amounts are paise, GST-inclusive, and are
 *  ALWAYS server-computed — nothing here is ever accepted from a client. */
export interface PlanDraftQuoteLineItem {
  kind: "plan_cycle" | "delivery_fee" | "accompaniments" | "add_on" | "credit";
  label: string;
  amountPaise: number;
  /** Free-form provenance for auditability (plan id, add-on id, …). */
  reference: string | null;
}

/** The schedule the quote priced, frozen. Held on the quote rather than read
 *  back off the draft so a later reschedule cannot silently re-interpret what
 *  was quoted. */
export interface PlanDraftQuoteScheduleDay {
  deliveryDate: string;
  deliveryWindow: string;
  slotId: number | null;
}

export const planDraftQuotesTable = pgTable(
  "plan_draft_quotes",
  {
    /** Opaque, server-generated. Mirrors the draft id's shape. */
    id: varchar("id").primaryKey(),
    planDraftId: varchar("plan_draft_id")
      .notNull()
      .references(() => planDraftsTable.id, { onDelete: "cascade" }),
    /** The draft version this quote priced. A quote whose draft has moved past
     *  this version is stale by construction. */
    planDraftVersion: integer("plan_draft_version").notNull(),
    status: varchar("status", { length: 16 })
      .$type<PlanDraftQuoteStatus>()
      .notNull()
      .default("active"),

    subtotalPaise: integer("subtotal_paise").notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    /** GST-inclusive total — the figure that would be charged. */
    totalPaise: integer("total_paise").notNull(),
    lineItems: jsonb("line_items")
      .$type<PlanDraftQuoteLineItem[]>()
      .notNull()
      .default([]),
    schedule: jsonb("schedule")
      .$type<PlanDraftQuoteScheduleDay[]>()
      .notNull()
      .default([]),

    /** Capacity held for this quote is released when it lapses — a browsing
     *  customer must not hold kitchen capacity indefinitely. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_plan_draft_quotes_draft").on(table.planDraftId),
    index("idx_plan_draft_quotes_status").on(table.status),
    index("idx_plan_draft_quotes_expires").on(table.expiresAt),
  ],
);

export type PlanDraftQuote = typeof planDraftQuotesTable.$inferSelect;
export type InsertPlanDraftQuote = typeof planDraftQuotesTable.$inferInsert;
