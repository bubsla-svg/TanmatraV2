import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/**
 * Saved Meals table representing PRD Feature #1: Favorites / "My Protocol Vault".
 * Enables members to bookmark canonical dishes and record personal therapeutic
 * annotations and macro customization preferences for rapid re-ordering.
 */
export const savedMealsTable = pgTable(
  "saved_meals",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    dishSlug: varchar("dish_slug", { length: 128 }).notNull(),
    dishName: varchar("dish_name", { length: 256 }).notNull(),
    notes: text("notes").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_saved_meals_user_id").on(table.userId),
    unique("unq_saved_meals_user_dish").on(table.userId, table.dishSlug),
  ],
);
