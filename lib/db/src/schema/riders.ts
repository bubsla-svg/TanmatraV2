import { pgTable, serial, varchar, integer, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ridersTable = pgTable(
  "riders",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    zone: varchar("zone", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("offline"),
    rating: doublePrecision("rating").notNull().default(5.0),
    activeOrderCount: integer("active_order_count").notNull().default(0),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Rider assignment (routes/delivery.ts, dispatch.ts) filters
    // status = 'online' and orders by active_order_count/rating — this
    // table previously had zero indexes, so that was a full scan + sort.
    index("idx_riders_status_load").on(table.status, table.activeOrderCount),
  ],
);

export const insertRiderSchema = createInsertSchema(ridersTable).omit({ id: true, createdAt: true });
export type InsertRider = z.infer<typeof insertRiderSchema>;
export type Rider = typeof ridersTable.$inferSelect;
