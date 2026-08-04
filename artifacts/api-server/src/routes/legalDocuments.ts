import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  createDraft,
  getCompanyProfile,
  getDraft,
  getPublishedDocument,
  listDrafts,
  listPublishedDocuments,
  publishDraft,
  updateDraft,
  type PublicLegalDocumentDetail,
  type PublicLegalDocumentSummary,
} from "../lib/legalDocuments";
import { requireRole } from "../lib/adminGate";
import { recordAdminAction } from "../lib/adminAudit";
import type { LegalCompanyProfile } from "@workspace/db";

const router: IRouter = Router();

const SLUG_RE = /^[a-z0-9-]+$/;
const slugParam = z.object({ slug: z.string().trim().min(1).max(64).regex(SLUG_RE) });

const legalSectionSchema = z.object({
  heading: z.string().trim().min(1).max(300),
  body: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
});

const createBodySchema = z.object({
  slug: z.string().trim().min(1).max(64).regex(SLUG_RE),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(500).optional(),
  body: z.array(legalSectionSchema).optional(),
});

const updateBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    summary: z.string().max(500).optional(),
    body: z.array(legalSectionSchema).optional(),
  })
  .refine((v) => v.title !== undefined || v.summary !== undefined || v.body !== undefined, {
    message: "at least one of title, summary, body is required",
  });

const publishBodySchema = z.object({
  effectiveFrom: z.string().trim().datetime().optional(),
});

function isUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/** Public shape of the company/entity singleton — internal bookkeeping
 *  columns (id, singletonKey, updatedBy) are never exposed to the browser. */
function serializeCompanyProfile(row: LegalCompanyProfile) {
  return {
    legalName: row.legalName,
    brand: row.brand,
    fssaiLicenseNo: row.fssaiLicenseNo,
    fssaiValidUpto: row.fssaiValidUpto,
    cin: row.cin,
    registeredOffice: row.registeredOffice,
    grievanceOfficer: row.grievanceOfficer,
    grievanceEmail: row.grievanceEmail,
    privacyEmail: row.privacyEmail,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    serviceAreas: row.serviceAreas,
    jurisdictionCity: row.jurisdictionCity,
    jurisdictionState: row.jurisdictionState,
    updatedAt: row.updatedAt,
  };
}

function serializeSummary(doc: PublicLegalDocumentSummary) {
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    version: doc.version,
    effectiveFrom: doc.effectiveFrom,
    publishedAt: doc.publishedAt,
  };
}

function serializeDetail(doc: PublicLegalDocumentDetail) {
  return { ...serializeSummary(doc), body: doc.body };
}

// ---------------------------------------------------------------------------
// Public — published documents only. Both routes join through
// legal_documents.publishedVersionId (see lib/legalDocuments.ts), so a draft
// that has never been published is absent from the list and 404s by slug —
// "not reachable publicly" is a consequence of the query, not a check here.
// ---------------------------------------------------------------------------

router.get("/legal-documents", async (_req: Request, res: Response) => {
  const [documents, company] = await Promise.all([
    listPublishedDocuments(),
    getCompanyProfile(),
  ]);
  res.json({
    documents: documents.map(serializeSummary),
    company: company ? serializeCompanyProfile(company) : null,
  });
});

router.get("/legal-documents/:slug", async (req: Request, res: Response) => {
  const sp = slugParam.safeParse(req.params);
  if (!sp.success) {
    res.status(400).json({ error: "invalid slug" });
    return;
  }
  const [document, company] = await Promise.all([
    getPublishedDocument(sp.data.slug),
    getCompanyProfile(),
  ]);
  if (!document) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({
    document: serializeDetail(document),
    company: company ? serializeCompanyProfile(company) : null,
  });
});

// ---------------------------------------------------------------------------
// Admin — role `compliance`. Read/write the DRAFT row only; publishing is
// the one operation that also touches legal_document_versions.
// ---------------------------------------------------------------------------

router.get("/admin/legal-documents", async (req: Request, res: Response) => {
  const gate = await requireRole(req, res, ["compliance"]);
  if (!gate) return;
  const documents = await listDrafts();
  res.json({ documents });
});

router.post("/admin/legal-documents", async (req: Request, res: Response) => {
  const gate = await requireRole(req, res, ["compliance"]);
  if (!gate) return;
  const operatorId = gate.operatorId!;
  const bp = createBodySchema.safeParse(req.body);
  if (!bp.success) {
    res.status(400).json({ error: bp.error.message });
    return;
  }
  const existing = await getDraft(bp.data.slug);
  if (existing) {
    res.status(409).json({ error: "slug already exists" });
    return;
  }
  try {
    const document = await db.transaction(async (tx) => {
      const doc = await createDraft({ ...bp.data, updatedBy: operatorId }, tx);
      await recordAdminAction({
        operatorId,
        action: "legal_documents.create",
        resourceType: "legal_document",
        resourceId: doc.slug,
        beforeState: null,
        afterState: doc,
        ipAddress: req.ip ?? req.socket?.remoteAddress,
      }, tx);
      return doc;
    });
    res.status(201).json({ document });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "slug already exists" });
      return;
    }
    throw err;
  }
});

router.put("/admin/legal-documents/:slug", async (req: Request, res: Response) => {
  const gate = await requireRole(req, res, ["compliance"]);
  if (!gate) return;
  const operatorId = gate.operatorId!;
  const sp = slugParam.safeParse(req.params);
  const bp = updateBodySchema.safeParse(req.body);
  if (!sp.success || !bp.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const before = await getDraft(sp.data.slug);
  if (!before) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const document = await db.transaction(async (tx) => {
    const doc = await updateDraft(sp.data.slug, bp.data, operatorId, tx);
    if (!doc) return null;
    await recordAdminAction({
      operatorId,
      action: "legal_documents.update_draft",
      resourceType: "legal_document",
      resourceId: sp.data.slug,
      beforeState: { title: before.title, summary: before.summary, body: before.body },
      afterState: { title: doc.title, summary: doc.summary, body: doc.body },
      ipAddress: req.ip ?? req.socket?.remoteAddress,
    }, tx);
    return doc;
  });
  if (!document) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ document });
});

router.post(
  "/admin/legal-documents/:slug/publish",
  async (req: Request, res: Response) => {
    const gate = await requireRole(req, res, ["compliance"]);
    if (!gate) return;
    const operatorId = gate.operatorId!;
    const sp = slugParam.safeParse(req.params);
    const bp = publishBodySchema.safeParse(req.body ?? {});
    if (!sp.success || !bp.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const effectiveFrom = bp.data.effectiveFrom ? new Date(bp.data.effectiveFrom) : undefined;

    try {
      // The version insert, the pointer repoint, and the audit row must
      // commit atomically: a transient audit-write failure after an
      // already-committed publish would leave the new version live with no
      // audit row and a 5xx response that claims otherwise — same reasoning
      // as routes/menu.ts's price-update handler.
      const result = await db.transaction(async (tx) => {
        const before = await getDraft(sp.data.slug, tx);
        const published = await publishDraft(sp.data.slug, operatorId, effectiveFrom, tx);
        if (!published) return null;
        await recordAdminAction(
          {
            operatorId,
            action: "legal_documents.publish",
            resourceType: "legal_document",
            resourceId: sp.data.slug,
            beforeState: { publishedVersionId: before?.publishedVersionId ?? null },
            afterState: {
              publishedVersionId: published.document.publishedVersionId,
              version: published.version.version,
            },
            ipAddress: req.ip ?? req.socket?.remoteAddress,
          },
          tx,
        );
        return published;
      });
      if (!result) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json({ document: result.document, version: result.version });
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "publish conflict — retry" });
        return;
      }
      throw err;
    }
  },
);

export default router;
