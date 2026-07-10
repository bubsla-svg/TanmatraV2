import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

/**
 * Refund-after-approval pipeline. A paid order that gets cancelled raises a
 * `pending` refund request instead of firing an irreversible gateway refund
 * automatically; an operator approves it, and only then does the server call
 * Razorpay to move the money.
 *
 *   pending    → raised by cancel, awaiting an operator decision
 *   processing → an approve claimed the row and is calling the gateway
 *   refunded   → gateway confirmed the refund (razorpay_refund_id set)
 *   failed     → gateway call failed; re-approvable (ops can retry)
 *   rejected   → an operator declined the refund
 *
 * One request per order (unique order_id) so a cancel can't stack duplicates.
 */
export type RefundStatus =
  | "pending"
  | "processing"
  | "refunded"
  | "failed"
  | "rejected";

export const refundRequestsTable = pgTable(
  "refund_requests",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id),
    externalOrderId: varchar("external_order_id", { length: 64 }),
    amountPaise: integer("amount_paise").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    reason: varchar("reason", { length: 256 }),
    // The Razorpay payment to refund against (refunds target a payment, not an
    // order). Copied from the order at request time; without it a refund can't
    // be issued and approve returns a 409.
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 64 }),
    razorpayRefundId: varchar("razorpay_refund_id", { length: 64 }),
    requestedBy: varchar("requested_by"),
    decidedBy: varchar("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    note: varchar("note", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uniq_refund_requests_order").on(table.orderId),
    index("idx_refund_requests_status_created").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export type RefundRequest = typeof refundRequestsTable.$inferSelect;
