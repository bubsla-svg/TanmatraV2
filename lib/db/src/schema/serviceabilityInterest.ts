import {
  pgTable,
  varchar,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Unserviceable location interest capture (OB-3 / II.3).
 * Stores only {pincode, phone, createdAt} per our strict projection pin.
 * Composite primary key on (pincode, phone) ensures built-in deduplication and idempotency.
 */
export const serviceabilityInterestTable = pgTable(
  "serviceability_interest",
  {
    pincode: varchar("pincode", { length: 6 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.pincode, table.phone] }),
  ],
);

export type ServiceabilityInterest = typeof serviceabilityInterestTable.$inferSelect;
