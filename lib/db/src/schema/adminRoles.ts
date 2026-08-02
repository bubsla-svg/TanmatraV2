import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const adminRolesTable = pgTable(
  "admin_roles",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // Role names e.g., "ops", "catalog", "compliance", "kitchen", "finance"
    role: varchar("role", { length: 32 }).notNull(),
    assignedBy: varchar("assigned_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] })
  ]
);

export type AdminRole = typeof adminRolesTable.$inferSelect;
export type InsertAdminRole = typeof adminRolesTable.$inferInsert;
