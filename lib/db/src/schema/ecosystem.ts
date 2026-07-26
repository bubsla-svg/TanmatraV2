import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/**
 * Symptom Logs table (PRD Feature #10).
 * Captures user physiological responses (bloating, glucose stability, satiety)
 * correlated with dietary intake and meal protocols.
 */
export const symptomLogsTable = pgTable(
  "symptom_logs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    loggedDate: varchar("logged_date", { length: 32 }).notNull(),
    symptomType: varchar("symptom_type", { length: 64 }).notNull(),
    severity: integer("severity").notNull().default(1),
    notes: text("notes").notNull().default(""),
    relatedDishSlug: varchar("related_dish_slug", { length: 128 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_symptom_logs_user").on(table.userId, table.loggedDate),
  ],
);

export type SymptomLog = typeof symptomLogsTable.$inferSelect;

/**
 * Community Q&A Threads table (PRD Feature #5).
 * Hosts open clinical nutrition discussions answered by verified Registered Dietitians (RDs).
 */
export const communityQaThreadsTable = pgTable(
  "community_qa_threads",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    authorName: varchar("author_name", { length: 128 }).notNull().default("Member"),
    questionTitle: varchar("question_title", { length: 256 }).notNull(),
    questionBody: text("question_body").notNull(),
    category: varchar("category", { length: 64 }).notNull().default("general"),
    rdAnswer: text("rd_answer").notNull().default(""),
    rdAnsweredBy: varchar("rd_answered_by", { length: 128 }).notNull().default(""),
    upvotes: integer("upvotes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_community_qa_category").on(table.category, table.createdAt),
    index("idx_community_qa_user").on(table.userId),
  ],
);

export type CommunityQaThread = typeof communityQaThreadsTable.$inferSelect;
