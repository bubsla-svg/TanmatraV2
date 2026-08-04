import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Policy / legal / disclaimer CMS (TNM-ADM-01 ADM-20).
 *
 * Replaces the compiled `artifacts/storefront/content/legal/*.ts` modules
 * with a draft/publish model split across three tables:
 *
 *   - `legalDocumentsTable`      — one row per slug, the current DRAFT.
 *   - `legalDocumentVersionsTable` — append-only publish history.
 *   - `legalCompanyProfileTable` — the entity/FSSAI/contact singleton.
 *
 * The section shape below mirrors the storefront's `LegalSection` type
 * (`artifacts/storefront/content/legal/types.ts`) field-for-field so the
 * migration seed can copy the existing `LegalDoc.sections` arrays into
 * `body` verbatim, with no reshaping.
 */
export interface LegalSection {
  /** Section heading (rendered as <h2>). */
  heading: string;
  /** Prose paragraphs. */
  body?: string[];
  /** Optional bullet list rendered after the prose. */
  bullets?: string[];
}

/**
 * `legal_documents` — one row per slug, holding the current DRAFT working
 * copy. `PUT /admin/legal-documents/:slug` writes ONLY to this row.
 *
 * `publishedVersionId` is the single fact that decides public visibility: it
 * is null until the slug's first publish, and every public read
 * (`GET /legal-documents`, `GET /legal-documents/:slug`) joins through it
 * rather than reading `title`/`summary`/`body` here directly. That is what
 * makes "editing the draft must not change what's publicly visible" and "an
 * unpublished draft is not reachable publicly" true by construction instead
 * of by a runtime check someone has to remember to keep calling.
 *
 * No FK constraint from `publishedVersionId` to
 * `legal_document_versions.id` is declared here (Drizzle would need a
 * circular reference between the two tables to declare it either
 * direction first) — referential integrity is instead enforced entirely in
 * application code (`publishDraft` in `artifacts/api-server/src/lib/
 * legalDocuments.ts`), the only place this column is ever written.
 */
export const legalDocumentsTable = pgTable(
  "legal_documents",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    summary: varchar("summary", { length: 500 }).notNull().default(""),
    body: jsonb("body").$type<LegalSection[]>().notNull().default([]),
    publishedVersionId: integer("published_version_id"),
    updatedBy: varchar("updated_by", { length: 128 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("legal_documents_slug_idx").on(table.slug)],
);

/**
 * `legal_document_versions` — append-only. A row is inserted exactly once,
 * by `publishDraft`, and is never UPDATEd or DELETEd afterward: "publishing
 * a new version does not mutate the prior version row" is the acceptance
 * criterion this table exists to satisfy. `version` is 1-based per slug
 * (not a global counter), computed as `MAX(version) WHERE slug = ? + 1` at
 * publish time inside the same transaction that repoints
 * `legal_documents.publishedVersionId` — see `publishDraft`.
 *
 * The (slug, version) unique index is the hard backstop for that
 * computation: two concurrent publishes of the same slug can both read the
 * same "current max" under READ COMMITTED, but only one of their inserts
 * can win — the other hits the unique-violation and the route surfaces it
 * as a 409 asking the caller to retry, rather than silently double-writing
 * (or skipping) a version number.
 */
export const legalDocumentVersionsTable = pgTable(
  "legal_document_versions",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    version: integer("version").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    summary: varchar("summary", { length: 500 }).notNull().default(""),
    body: jsonb("body").$type<LegalSection[]>().notNull().default([]),
    // When this version's content takes legal effect. Defaults to the
    // publish moment but is settable separately (e.g. publishing today a
    // policy that takes effect on a future date).
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedBy: varchar("published_by", { length: 128 }).notNull(),
  },
  (table) => [
    uniqueIndex("legal_document_versions_slug_version_idx").on(
      table.slug,
      table.version,
    ),
  ],
);

/**
 * `legal_company_profile` — the entity/FSSAI/contact block shown across
 * every legal page and the site footer, structured (per the runbook) as a
 * singleton distinct from the six document slugs rather than a seventh
 * pseudo-document: it has fields, not prose sections, and every page reads
 * the whole thing rather than one slug at a time.
 *
 * Deliberately UNVERSIONED — the runbook allows skipping version history
 * here, and unlike the six documents this table has no legal requirement to
 * prove what a past visitor was shown (it is contact/registration
 * metadata, not a policy someone agreed to). `singletonKey` is a fixed
 * literal ("singleton") under a unique index so a second INSERT collides
 * instead of quietly creating a second "current" row with undefined
 * precedence; there is intentionally no admin route to write this table in
 * ADM-20 (see the migration seed) — only the one-time migration populates
 * it, matching the runbook's route list, which lists no
 * `/admin/legal-company` endpoint.
 *
 * `fssaiValidUpto` has no source field in the storefront's `COMPANY`
 * const being migrated (`artifacts/storefront/content/legal/company.ts`)
 * even though the runbook's singleton description calls for
 * "FSSAI licence + valid-upto" — the migration seeds it as an explicit
 * loud placeholder, consistent with the other not-yet-confirmed fields
 * COMPANY already carries as literal `"[... — to be inserted]"` strings.
 */
export const legalCompanyProfileTable = pgTable(
  "legal_company_profile",
  {
    id: serial("id").primaryKey(),
    singletonKey: varchar("singleton_key", { length: 16 })
      .notNull()
      .default("singleton"),
    legalName: varchar("legal_name", { length: 200 }).notNull(),
    brand: varchar("brand", { length: 100 }).notNull(),
    fssaiLicenseNo: varchar("fssai_license_no", { length: 64 }).notNull(),
    fssaiValidUpto: varchar("fssai_valid_upto", { length: 100 }).notNull(),
    cin: varchar("cin", { length: 100 }).notNull(),
    registeredOffice: text("registered_office").notNull(),
    grievanceOfficer: varchar("grievance_officer", { length: 200 }).notNull(),
    grievanceEmail: varchar("grievance_email", { length: 200 }).notNull(),
    privacyEmail: varchar("privacy_email", { length: 200 }).notNull(),
    supportEmail: varchar("support_email", { length: 200 }).notNull(),
    supportPhone: varchar("support_phone", { length: 32 }).notNull(),
    serviceAreas: text("service_areas").notNull(),
    jurisdictionCity: varchar("jurisdiction_city", { length: 100 }).notNull(),
    jurisdictionState: varchar("jurisdiction_state", { length: 100 }).notNull(),
    updatedBy: varchar("updated_by", { length: 128 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_company_profile_singleton_idx").on(table.singletonKey),
  ],
);

export type LegalDocument = typeof legalDocumentsTable.$inferSelect;
export type InsertLegalDocument = typeof legalDocumentsTable.$inferInsert;
export type LegalDocumentVersion = typeof legalDocumentVersionsTable.$inferSelect;
export type InsertLegalDocumentVersion =
  typeof legalDocumentVersionsTable.$inferInsert;
export type LegalCompanyProfile = typeof legalCompanyProfileTable.$inferSelect;
export type InsertLegalCompanyProfile =
  typeof legalCompanyProfileTable.$inferInsert;
