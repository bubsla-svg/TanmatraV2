import { pgTable, serial, doublePrecision, boolean, jsonb, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";

export const complianceLogsTable = pgTable(
  "compliance_logs",
  {
    id: serial("id").primaryKey(),
    logDate: date("log_date").notNull(),
    coldStorageTempCelsius: doublePrecision("cold_storage_temp_celsius").notNull(),
    hygieneConfirmed: boolean("hygiene_confirmed").notNull().default(true),
    deliveryBatches: jsonb("delivery_batches").$type<
      Array<{
        product: string;
        farmOrigin: string;
        batchCode: string;
        harvestDate: string;
      }>
    >().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_compliance_log_date").on(table.logDate),
  ]
);

export type ComplianceLog = typeof complianceLogsTable.$inferSelect;
export type InsertComplianceLog = typeof complianceLogsTable.$inferInsert;
