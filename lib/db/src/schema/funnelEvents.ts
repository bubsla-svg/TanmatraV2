import {
  pgTable,
  serial,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * First-party funnel event log. The SPA's track() beacons land here so
 * conversion questions (menu→cart, checkout completion, drop-off) are
 * answerable from the warehouse the admin analytics console already
 * queries — no third-party vendor required, none configured. Props are
 * scrubbed client-side; no health data is ever written here.
 */
export const funnelEventsTable = pgTable(
  "funnel_events",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
    props: jsonb("props").$type<Record<string, unknown>>(),
    sessionId: varchar("session_id", { length: 64 }),
    userId: varchar("user_id"),
    path: varchar("path", { length: 256 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_funnel_events_name_time").on(table.name, table.createdAt),
    index("idx_funnel_events_session").on(table.sessionId),
  ],
);

export type FunnelEvent = typeof funnelEventsTable.$inferSelect;
