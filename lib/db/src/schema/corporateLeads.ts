import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export type CorporateLeadKind = "corporate" | "gym" | "fitness_club" | "rd" | "trainer" | "dietitian";
export type CorporateLeadStatus = "new" | "contacted" | "qualified" | "closed";

/**
 * Captured B2B / partnership leads (playbook Part 3.3 — "the fix" for the
 * WhatsApp lead leak). Every corporate-wellness, gym, and fitness-club
 * landing form posts here so the pipeline lives in our own CRM surface
 * (AdminSalesConsole) instead of a wa.me handoff. `source` records the
 * page slug plus any utm params so paid-acquisition attribution works.
 */
export const corporateLeadsTable = pgTable(
  "corporate_leads",
  {
    id: serial("id").primaryKey(),
    kind: varchar("kind", { length: 24 }).notNull().$type<CorporateLeadKind>(),
    name: varchar("name", { length: 80 }).notNull(),
    workEmail: varchar("work_email", { length: 256 }).notNull(),
    company: varchar("company", { length: 120 }).notNull(),
    teamSizeBand: varchar("team_size_band", { length: 32 }).notNull(),
    parkOrSector: varchar("park_or_sector", { length: 120 }),
    phone: varchar("phone", { length: 20 }),
    message: text("message"),
    source: varchar("source", { length: 160 }),
    rdRegNo: varchar("rd_reg_no", { length: 80 }),
    practiceSetting: varchar("practice_setting", { length: 64 }),
    status: varchar("status", { length: 16 })
      .notNull()
      .default("new")
      .$type<CorporateLeadStatus>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_corporate_leads_status_time").on(table.status, table.createdAt),
  ],
);

export type CorporateLead = typeof corporateLeadsTable.$inferSelect;
