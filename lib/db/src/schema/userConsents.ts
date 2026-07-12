import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export type ConsentStatus = "granted" | "revoked" | "expired";

export const userConsentsTable = pgTable(
  "user_consents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    purposeClinicalDelivery: boolean("purpose_clinical_delivery")
      .notNull()
      .default(true),
    purposeMarketing: boolean("purpose_marketing").notNull().default(false),
    purposeAiPersonalization: boolean("purpose_ai_personalization")
      .notNull()
      .default(false),
    purposeHealthDataProcessing: boolean("purpose_health_data_processing")
      .notNull()
      .default(false),
    consentVersion: varchar("consent_version", { length: 64 })
      .notNull()
      .default("2023_DPDPA_v1"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    status: varchar("status", { length: 32 })
      .$type<ConsentStatus>()
      .notNull()
      .default("granted"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_user_consents_user_id").on(table.userId),
    index("idx_user_consents_status").on(table.status),
    check(
      "user_consents_status_chk",
      sql`${table.status} in ('granted', 'revoked', 'expired')`,
    ),
  ],
);

export type UserConsent = typeof userConsentsTable.$inferSelect;
export type InsertUserConsent = typeof userConsentsTable.$inferInsert;
