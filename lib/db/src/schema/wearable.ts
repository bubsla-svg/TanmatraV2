import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  date,
  uniqueIndex,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";

/**
 * Wearable metrics ingestion spine (INCREMENT 1).
 *
 * Provider-agnostic: rows come from a cloud aggregator (Terra/Vital) via
 * webhook, normalized into a flat metric shape. The design is deliberately
 * metric-typed (one row = one measurement of one metric) so new metric types
 * — notably GLUCOSE in phase 2 — slot in without a schema change.
 *
 * The whole subsystem is feature-flagged OFF until WEARABLE_* env is set; these
 * tables simply stay empty until then.
 */

// Metric types ingested NOW (activity only). `glucose_mgdl` is intentionally
// listed but commented as PHASE 2 — the schema/normalizer/sanitizer are made
// glucose-ready, but glucose is NOT ingested in increment 1.
export type WearableMetricType =
  | "steps"
  | "active_energy_kcal"
  | "resting_hr"
  | "sleep_minutes";
// | "glucose_mgdl"  // PHASE 2 — do not ingest yet.

export const wearableMetricsTable = pgTable(
  "wearable_metrics",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Aggregator/provider that produced this metric ("terra"|"vital"|"mock").
    provider: varchar("provider", { length: 24 }).notNull(),
    // See WearableMetricType. Stored as varchar (not a pg enum) so phase-2
    // glucose needs no destructive migration.
    metricType: varchar("metric_type", { length: 32 })
      .$type<WearableMetricType>()
      .notNull(),
    // Value stored as a SCALED INTEGER to avoid float drift. Units per type:
    //   steps               → count (unit "count")
    //   active_energy_kcal  → kilocalories (unit "kcal")
    //   resting_hr          → beats/min (unit "bpm")
    //   sleep_minutes       → minutes (unit "min")
    //   glucose_mgdl (P2)   → mg/dL (unit "mg/dL")
    // Sub-unit metrics (none today) would scale by 10/100; document per type.
    value: integer("value").notNull(),
    unit: varchar("unit", { length: 16 }).notNull(),
    // The DATA timestamp (when the measurement was taken), ALWAYS stored UTC.
    // Never the ingest time. This is what the normalizer guarantees.
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    // Where it came from, e.g. "terra:garmin", "terra:fitbit", "mock".
    source: varchar("source", { length: 64 }).notNull(),
    // Stable idempotency key derived from (provider, providerUserId, metric,
    // recordedAt). Duplicate webhooks upsert-do-nothing on this.
    dedupeKey: varchar("dedupe_key", { length: 120 }),
    // Sanitizer flagged this as a physiologically impossible outlier. Flagged
    // rows are STORED (never silently dropped) but EXCLUDED from the rollup.
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_wearable_metrics_dedupe")
      .on(table.userId, table.dedupeKey)
      .where(sql`dedupe_key is not null`),
    index("idx_wearable_metrics_user_type_time").on(
      table.userId,
      table.metricType,
      table.recordedAt,
    ),
  ],
);

export type WearableMetric = typeof wearableMetricsTable.$inferSelect;
export type NewWearableMetric = typeof wearableMetricsTable.$inferInsert;

/**
 * Cheap per-day summary that the re-ranker / effectiveCalorieTarget path reads.
 * One row per (user, day). Recomputed from wearableMetricsTable whenever a
 * webhook touches that day. `day` is a calendar date (the user's/aggregator's
 * reporting day); the underlying instants in wearableMetricsTable are UTC.
 */
export const wearableDailyRollupTable = pgTable(
  "wearable_daily_rollup",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    provider: varchar("provider", { length: 24 }).notNull(),
    activeEnergyKcal: integer("active_energy_kcal").notNull().default(0),
    steps: integer("steps").notNull().default(0),
    // Average resting HR across the day (nullable — a day may have no HR data).
    restingHr: integer("resting_hr"),
    sleepMinutes: integer("sleep_minutes").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uniq_wearable_rollup_user_day").on(table.userId, table.day),
  ],
);

export type WearableDailyRollup = typeof wearableDailyRollupTable.$inferSelect;
export type NewWearableDailyRollup =
  typeof wearableDailyRollupTable.$inferInsert;
