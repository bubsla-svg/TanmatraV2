import { pgTable, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const quotesTable = pgTable("quotes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").references(() => usersTable.id),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  totalPaise: integer("total_paise").notNull(),
  items: jsonb("items").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
