import { pgTable, serial, integer, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { ridersTable } from "./riders";

export const deliveryEventsTable = pgTable(
  "delivery_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ordersTable.id),
    riderId: integer("rider_id").references(() => ridersTable.id),
    event: varchar("event", { length: 64 }).notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The order-tracking timeline, the support agent, and refund/anomaly
    // checks all filter on order_id and order by created_at; this table is
    // also high-write (every dispatch/refund/rider-sim event inserts a row),
    // so it needs an index rather than a per-lookup sequential scan.
    index("idx_delivery_events_order_created").on(table.orderId, table.createdAt),
    index("idx_delivery_events_rider").on(table.riderId),
  ],
);

export const insertDeliveryEventSchema = createInsertSchema(deliveryEventsTable).omit({ id: true, createdAt: true });
export type InsertDeliveryEvent = z.infer<typeof insertDeliveryEventSchema>;
export type DeliveryEvent = typeof deliveryEventsTable.$inferSelect;
