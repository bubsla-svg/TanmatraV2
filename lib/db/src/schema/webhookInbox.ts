import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type WebhookStatus = "pending" | "processed" | "failed" | "duplicate";

export const webhookInboxTable = pgTable(
  "webhook_inbox",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    eventId: varchar("event_id", { length: 128 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    signature: varchar("signature", { length: 512 }),
    payload: text("payload").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("webhook_inbox_source_event_id_uidx").on(
      table.source,
      table.eventId,
    ),
    index("webhook_inbox_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export type WebhookInbox = typeof webhookInboxTable.$inferSelect;
export type InsertWebhookInbox = typeof webhookInboxTable.$inferInsert;
