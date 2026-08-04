/**
 * One-time migration for TNM-ADM-01 ADM-20 — Policy, legal & disclaimer CMS.
 *
 * Moves `artifacts/storefront/content/legal/*.ts` (six `LegalDoc` consts +
 * the `COMPANY` singleton) into the `legal_documents` /
 * `legal_document_versions` / `legal_company_profile` tables, seeding each
 * document as an immediately-published version 1.
 *
 * VERBATIM, ON PURPOSE: this script imports the storefront's content
 * modules directly (a relative path across the package boundary, not a
 * `@workspace/*` dependency — those modules have zero runtime dependencies
 * of their own, so this is safe) rather than retyping the copy. That is
 * what "migrate verbatim, do not rewrite" means in practice: there is no
 * hand-transcription step for a reviewer to diff against the source.
 *
 * Idempotent: re-running skips any slug that already has a draft row, and
 * skips the company profile insert if a row already exists (the table is a
 * singleton — see lib/db/src/schema/legalDocuments.ts's doc comment). Safe
 * to run again after a partial failure.
 *
 * Usage:
 *   tsx scripts/src/seedLegalDocuments.ts            # dry run
 *   tsx scripts/src/seedLegalDocuments.ts --apply     # writes
 */
import {
  db,
  legalDocumentsTable,
  legalDocumentVersionsTable,
  legalCompanyProfileTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { LEGAL_DOCS, COMPANY } from "../../artifacts/storefront/content/legal";
import type { LegalDoc } from "../../artifacts/storefront/content/legal/types";

const APPLY = process.argv.includes("--apply");
const MIGRATION_OPERATOR = "system:migration-adm20";

/** COMPANY.updated is a human label like "24 July 2026" — every doc shares
 *  the same value, so it doubles as the effective-from date for every
 *  version-1 row this migration creates. Falls back to "now" if it were
 *  ever unparseable (it currently parses cleanly). */
function parseUpdatedLabel(label: string): Date {
  const parsed = new Date(label);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function migrateDocument(doc: LegalDoc, effectiveFrom: Date): Promise<"migrated" | "skipped"> {
  const [existing] = await db
    .select({ id: legalDocumentsTable.id })
    .from(legalDocumentsTable)
    .where(eq(legalDocumentsTable.slug, doc.slug))
    .limit(1);
  if (existing) return "skipped";

  if (!APPLY) return "migrated";

  await db.transaction(async (tx) => {
    const [draft] = await tx
      .insert(legalDocumentsTable)
      .values({
        slug: doc.slug,
        title: doc.title,
        summary: doc.summary,
        body: doc.sections,
        updatedBy: MIGRATION_OPERATOR,
      })
      .returning();
    if (!draft) throw new Error(`insert failed for slug ${doc.slug}`);

    const [version] = await tx
      .insert(legalDocumentVersionsTable)
      .values({
        slug: doc.slug,
        version: 1,
        title: doc.title,
        summary: doc.summary,
        body: doc.sections,
        effectiveFrom,
        publishedAt: new Date(),
        publishedBy: MIGRATION_OPERATOR,
      })
      .returning();
    if (!version) throw new Error(`version insert failed for slug ${doc.slug}`);

    await tx
      .update(legalDocumentsTable)
      .set({ publishedVersionId: version.id })
      .where(eq(legalDocumentsTable.slug, doc.slug));
  });
  return "migrated";
}

async function migrateCompanyProfile(): Promise<"migrated" | "skipped"> {
  const existing = await db.select({ id: legalCompanyProfileTable.id }).from(legalCompanyProfileTable).limit(1);
  if (existing.length > 0) return "skipped";
  if (!APPLY) return "migrated";

  await db.insert(legalCompanyProfileTable).values({
    legalName: COMPANY.legalName,
    brand: COMPANY.brand,
    fssaiLicenseNo: COMPANY.fssaiLicenseNo,
    // No source field for this in COMPANY (see the schema doc comment) —
    // seeded as an explicit loud placeholder, matching COMPANY's own style
    // for not-yet-confirmed fields.
    fssaiValidUpto: "[FSSAI licence valid-upto — to be inserted]",
    cin: COMPANY.cin,
    registeredOffice: COMPANY.registeredOffice,
    grievanceOfficer: COMPANY.grievanceOfficer,
    grievanceEmail: COMPANY.grievanceEmail,
    privacyEmail: COMPANY.privacyEmail,
    supportEmail: COMPANY.supportEmail,
    supportPhone: COMPANY.supportPhone,
    serviceAreas: COMPANY.serviceAreas,
    jurisdictionCity: COMPANY.jurisdictionCity,
    jurisdictionState: COMPANY.jurisdictionState,
    updatedBy: MIGRATION_OPERATOR,
  });
  return "migrated";
}

async function main() {
  console.log(
    `Migrating ${LEGAL_DOCS.length} legal documents + the company profile${APPLY ? "" : " (dry-run, pass --apply to write)"}...`,
  );

  const effectiveFrom = parseUpdatedLabel(COMPANY.updated);
  let migrated = 0;
  let skipped = 0;

  for (const doc of LEGAL_DOCS) {
    const result = await migrateDocument(doc, effectiveFrom);
    console.log(`  [${result}] ${doc.slug}`);
    if (result === "migrated") migrated++;
    else skipped++;
  }

  const companyResult = await migrateCompanyProfile();
  console.log(`  [${companyResult}] company profile`);
  if (companyResult === "migrated") migrated++;
  else skipped++;

  console.log(`Done: ${migrated} migrated, ${skipped} already present.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Legal-documents migration failed:", err);
  process.exit(1);
});
