import { pgTable, varchar, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { quotesTable } from "./quotes";
import { ordersTable } from "./orders";

export const paymentAttemptsTable = pgTable("payment_attempts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  customerId: varchar("customer_id").notNull().references(() => usersTable.id),
  quoteId: varchar("quote_id").notNull().references(() => quotesTable.id),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("created"),
  providerReference: varchar("provider_reference", { length: 64 }),
  orderId: varchar("order_id", { length: 64 }), // To support string external orders if needed
  internalOrderId: integer("internal_order_id").references(() => ordersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("uniq_payment_attempts_customer_idempotency").on(table.customerId, table.idempotencyKey)
]);
