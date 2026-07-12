import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageDispatchesTable = pgTable("message_dispatches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  templateId: varchar("template_id", { length: 64 }).notNull(),
  serviceDate: varchar("service_date", { length: 16 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  dedupeKey: varchar("dedupe_key", { length: 128 }).notNull().unique(),
});

export const insertMessageDispatchSchema = createInsertSchema(
  messageDispatchesTable,
).omit({ id: true, sentAt: true });
export type InsertMessageDispatch = z.infer<typeof insertMessageDispatchSchema>;
export type MessageDispatch = typeof messageDispatchesTable.$inferSelect;
