import {
  pgTable,
  serial,
  varchar,
  integer,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Nightly per-day, per-event rollup of funnel_events (playbook Part 8, A1).
// The funnelRollupScheduler upserts one row per (day, name); re-running a day
// recomputes it idempotently. distinct_sessions / distinct_users are counted
// within the day only — summing them across days over-counts visitors that
// span midnight, which is acceptable for directional funnel reporting.
// Server-emitted money events (source:"server") carry no session_id, so
// event_count is the reliable column for funnel step math.
export const funnelDailyTable = pgTable(
  "funnel_daily",
  {
    id: serial("id").primaryKey(),
    day: date("day").notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    eventCount: integer("event_count").notNull().default(0),
    distinctSessions: integer("distinct_sessions").notNull().default(0),
    distinctUsers: integer("distinct_users").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("uniq_funnel_daily_day_name").on(t.day, t.name)],
);
export type FunnelDaily = typeof funnelDailyTable.$inferSelect;
