import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  legalDocumentsTable,
  legalDocumentVersionsTable,
  legalCompanyProfileTable,
  type LegalDocument,
  type LegalDocumentVersion,
  type LegalCompanyProfile,
  type LegalSection,
} from "@workspace/db";

/** Minimal executor shapes — accept either the global `db` or a `tx` handle
 *  from `db.transaction`, same convention as lib/menu.ts. */
export type DbReadExecutor = Pick<typeof db, "select">;
export type DbWriteExecutor = Pick<typeof db, "insert" | "update">;

export interface PublicLegalDocumentSummary {
  slug: string;
  title: string;
  summary: string;
  version: number;
  effectiveFrom: Date;
  publishedAt: Date;
}

export interface PublicLegalDocumentDetail extends PublicLegalDocumentSummary {
  body: LegalSection[];
}

/** Every published document, ordered by creation (= the original
 *  terms/privacy/refunds/shipping/disclaimer/grievance seed order). Reads
 *  ONLY through `publishedVersionId` — a slug with no published version is
 *  simply absent, never a draft peeking through. */
export async function listPublishedDocuments(
  executor: DbReadExecutor = db,
): Promise<PublicLegalDocumentSummary[]> {
  return executor
    .select({
      slug: legalDocumentsTable.slug,
      version: legalDocumentVersionsTable.version,
      title: legalDocumentVersionsTable.title,
      summary: legalDocumentVersionsTable.summary,
      effectiveFrom: legalDocumentVersionsTable.effectiveFrom,
      publishedAt: legalDocumentVersionsTable.publishedAt,
    })
    .from(legalDocumentsTable)
    .innerJoin(
      legalDocumentVersionsTable,
      eq(legalDocumentsTable.publishedVersionId, legalDocumentVersionsTable.id),
    )
    .orderBy(asc(legalDocumentsTable.id));
}

/** One published document by slug, body included. `null` if the slug is
 *  unknown OR has never been published (a draft-only row) — the two cases
 *  are indistinguishable to a public caller by design. */
export async function getPublishedDocument(
  slug: string,
  executor: DbReadExecutor = db,
): Promise<PublicLegalDocumentDetail | null> {
  const [row] = await executor
    .select({
      slug: legalDocumentsTable.slug,
      version: legalDocumentVersionsTable.version,
      title: legalDocumentVersionsTable.title,
      summary: legalDocumentVersionsTable.summary,
      body: legalDocumentVersionsTable.body,
      effectiveFrom: legalDocumentVersionsTable.effectiveFrom,
      publishedAt: legalDocumentVersionsTable.publishedAt,
    })
    .from(legalDocumentsTable)
    .innerJoin(
      legalDocumentVersionsTable,
      eq(legalDocumentsTable.publishedVersionId, legalDocumentVersionsTable.id),
    )
    .where(eq(legalDocumentsTable.slug, slug))
    .limit(1);
  return row ?? null;
}

/** The single company/entity profile row, or `null` if the migration seed
 *  has never run. There is intentionally no `getOrThrow` here — callers
 *  (routes) decide how to degrade. */
export async function getCompanyProfile(
  executor: DbReadExecutor = db,
): Promise<LegalCompanyProfile | null> {
  const [row] = await executor.select().from(legalCompanyProfileTable).limit(1);
  return row ?? null;
}

/** The draft row for a slug (admin-only view — never exposed publicly). */
export async function getDraft(
  slug: string,
  executor: DbReadExecutor = db,
): Promise<LegalDocument | null> {
  const [row] = await executor
    .select()
    .from(legalDocumentsTable)
    .where(eq(legalDocumentsTable.slug, slug))
    .limit(1);
  return row ?? null;
}

export interface AdminDocumentListItem {
  slug: string;
  title: string;
  summary: string;
  updatedBy: string;
  updatedAt: Date;
  publishedVersion: number | null;
  publishedAt: Date | null;
}

/** Every draft row plus (if published) which version is currently live —
 *  what `GET /admin/legal-documents` renders so an operator can see draft
 *  vs. published state at a glance. */
export async function listDrafts(
  executor: DbReadExecutor = db,
): Promise<AdminDocumentListItem[]> {
  const rows = await executor
    .select({
      slug: legalDocumentsTable.slug,
      title: legalDocumentsTable.title,
      summary: legalDocumentsTable.summary,
      updatedBy: legalDocumentsTable.updatedBy,
      updatedAt: legalDocumentsTable.updatedAt,
      publishedVersion: legalDocumentVersionsTable.version,
      publishedAt: legalDocumentVersionsTable.publishedAt,
    })
    .from(legalDocumentsTable)
    .leftJoin(
      legalDocumentVersionsTable,
      eq(legalDocumentsTable.publishedVersionId, legalDocumentVersionsTable.id),
    )
    .orderBy(asc(legalDocumentsTable.id));
  return rows.map((r) => ({
    ...r,
    publishedVersion: r.publishedVersion ?? null,
    publishedAt: r.publishedAt ?? null,
  }));
}

export interface CreateDraftInput {
  slug: string;
  title: string;
  summary?: string;
  body?: LegalSection[];
  updatedBy: string;
}

/** Creates a brand-new slug's draft row. Callers must pre-check
 *  `getDraft(slug)` is null — the unique index on `slug` is the hard
 *  backstop, but the route wants a clean 409 rather than a raw
 *  constraint-violation error surfacing to the client. */
export async function createDraft(
  input: CreateDraftInput,
  executor: DbWriteExecutor = db,
): Promise<LegalDocument> {
  const [row] = await executor
    .insert(legalDocumentsTable)
    .values({
      slug: input.slug,
      title: input.title,
      summary: input.summary ?? "",
      body: input.body ?? [],
      updatedBy: input.updatedBy,
    })
    .returning();
  if (!row) throw new Error("legal document insert failed");
  return row;
}

export interface UpdateDraftInput {
  title?: string;
  summary?: string;
  body?: LegalSection[];
}

/** Edits the DRAFT only — never touches `publishedVersionId`. This is what
 *  makes "editing the draft must not change what's publicly visible" true
 *  by construction rather than by a check a future editor could forget. */
export async function updateDraft(
  slug: string,
  patch: UpdateDraftInput,
  updatedBy: string,
  executor: DbWriteExecutor = db,
): Promise<LegalDocument | null> {
  const [row] = await executor
    .update(legalDocumentsTable)
    .set({ ...patch, updatedBy, updatedAt: new Date() })
    .where(eq(legalDocumentsTable.slug, slug))
    .returning();
  return row ?? null;
}

export interface PublishResult {
  document: LegalDocument;
  version: LegalDocumentVersion;
}

/**
 * Snapshots the current draft into a new, immutable `legal_document_versions`
 * row and repoints `legal_documents.publishedVersionId` at it. The ONLY
 * place a version row is ever created.
 *
 * Must be called with a transaction executor (a `tx` from `db.transaction`)
 * by the route, so the version insert + pointer update + audit row
 * (recorded by the caller with the same `tx`) commit atomically — see
 * routes/menu.ts's price-update handler for the pattern this mirrors.
 *
 * Returns `null` if `slug` has no draft row (nothing to publish).
 */
export async function publishDraft(
  slug: string,
  publishedBy: string,
  effectiveFrom: Date | undefined,
  executor: DbReadExecutor & DbWriteExecutor,
): Promise<PublishResult | null> {
  const draft = await getDraft(slug, executor);
  if (!draft) return null;

  const [maxRow] = await executor
    .select({
      maxVersion: sql<number>`coalesce(max(${legalDocumentVersionsTable.version}), 0)::int`,
    })
    .from(legalDocumentVersionsTable)
    .where(eq(legalDocumentVersionsTable.slug, slug));
  const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

  const now = new Date();
  const [version] = await executor
    .insert(legalDocumentVersionsTable)
    .values({
      slug,
      version: nextVersion,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      effectiveFrom: effectiveFrom ?? now,
      publishedAt: now,
      publishedBy,
    })
    .returning();
  if (!version) throw new Error("legal document version insert failed");

  const [updated] = await executor
    .update(legalDocumentsTable)
    .set({ publishedVersionId: version.id, updatedBy: publishedBy, updatedAt: now })
    .where(eq(legalDocumentsTable.slug, slug))
    .returning();
  if (!updated) throw new Error("legal document pointer update failed");

  return { document: updated, version };
}
