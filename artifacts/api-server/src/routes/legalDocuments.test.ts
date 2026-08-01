/**
 * Route contract & integration tests for the Policy/Legal/Disclaimer CMS
 * (ADM-20):
 *
 *   - Public GET /legal-documents (+ :slug) never sees an unpublished draft.
 *   - PUT /admin/legal-documents/:slug edits the draft WITHOUT changing what
 *     the public routes serve.
 *   - POST .../publish snapshots the draft into a new, immutable version and
 *     repoints the public pointer — publishing a second time leaves the
 *     first version row untouched.
 *   - requireRole gates every /admin/legal-documents* route to `compliance`
 *     (401 unauthenticated, 403 wrong role, 200 with `compliance`).
 *   - Every mutation (create, update_draft, publish) writes exactly one
 *     audit_log row with the right before/after.
 *
 * Run with:
 *   node --test --test-force-exit --import tsx ./src/routes/legalDocuments.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after, describe } from "node:test";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express, type Request, type Response, type NextFunction } from "express";

const ADMIN_TOKEN = "test_legal_cms_token_adm20";
process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
process.env["ADMIN_SESSION_SECRET"] ||= "test-legal-cms-session-secret";
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const {
  db,
  auditLogTable,
  usersTable,
  adminRolesTable,
  legalDocumentsTable,
  legalDocumentVersionsTable,
  legalCompanyProfileTable,
} = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { default: legalDocumentsRouter } = await import("./legalDocuments");

const RUN = randomUUID().slice(0, 8);
const slug = (name: string) => `test-${name}-${RUN}`;

const USER_REGISTRY = new Map<string, { id: string }>();
const CREATED_ROLE_OPERATOR_IDS: string[] = [];
const CREATED_SLUGS: string[] = [];
// legal_company_profile is a genuine singleton (unique singletonKey) with no
// admin write route — the test below seeds it directly ONLY if no row exists
// yet, reusing one it finds (e.g. a real migration already run against a
// persistent DB). Only clean up the row in `after()` if this run is the one
// that created it: unconditionally deleting it would destroy real seeded
// data on a shared DB, and never deleting it would permanently block the
// real seedLegalDocuments.ts migration from ever inserting the real company
// profile in any database this test suite has touched.
let createdCompanyProfile = false;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: { id: string }; isAuthenticated: () => boolean };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    next();
  });
  app.use(legalDocumentsRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";

before(async () => {
  await new Promise<void>((resolve) => {
    server = http.createServer(makeApp()).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const s of CREATED_SLUGS) {
    await db.delete(legalDocumentVersionsTable).where(eq(legalDocumentVersionsTable.slug, s));
    await db.delete(legalDocumentsTable).where(eq(legalDocumentsTable.slug, s));
    await db.delete(auditLogTable).where(eq(auditLogTable.resourceId, s));
  }
  for (const id of CREATED_ROLE_OPERATOR_IDS) {
    await db.delete(adminRolesTable).where(eq(adminRolesTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
  if (createdCompanyProfile) {
    await db.delete(legalCompanyProfileTable).where(eq(legalCompanyProfileTable.singletonKey, "singleton"));
  }
});

async function assignRole(operatorId: string, role: "compliance" | "support"): Promise<void> {
  await db.insert(usersTable).values({
    id: operatorId,
    email: `legal-cms-test-${operatorId}-${RUN}@example.test`,
    firstName: "Test",
  });
  CREATED_ROLE_OPERATOR_IDS.push(operatorId);
  await db.insert(adminRolesTable).values({ userId: operatorId, role });
}

function complianceHeaders() {
  return { "x-admin-token": ADMIN_TOKEN, "content-type": "application/json" };
}

describe("Policy/Legal/Disclaimer CMS (ADM-20)", () => {
  test("requireRole gate: unauthenticated GET /admin/legal-documents is 401, not 403", async () => {
    const res = await fetch(`${baseUrl}/admin/legal-documents`);
    assert.equal(res.status, 401);
  });

  test("requireRole gate: an operator without `compliance` gets 403 on POST /admin/legal-documents", async () => {
    const uid = `TAN-LEGALCMS-support-${RUN}`;
    USER_REGISTRY.set(uid, { id: uid });
    await assignRole(uid, "support");
    const res = await fetch(`${baseUrl}/admin/legal-documents`, {
      method: "POST",
      headers: { "x-test-user-id": uid, "content-type": "application/json" },
      body: JSON.stringify({ slug: slug("unauthorized"), title: "x" }),
    });
    assert.equal(res.status, 403);
  });

  test("GET /legal-documents/:slug is 404 for a slug that was never created", async () => {
    const res = await fetch(`${baseUrl}/legal-documents/${slug("never-created")}`);
    assert.equal(res.status, 404);
  });

  test("full draft -> edit -> publish -> re-publish lifecycle", async () => {
    const docSlug = slug("disclaimer-lifecycle");
    CREATED_SLUGS.push(docSlug);

    // 1. Create the draft (compliance-gated).
    const createRes = await fetch(`${baseUrl}/admin/legal-documents`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({
        slug: docSlug,
        title: "Health & Nutrition Disclaimer",
        summary: "v1 summary",
        body: [{ heading: "1. General", body: ["Not medical advice."] }],
      }),
    });
    assert.equal(createRes.status, 201);

    // Creating the same slug again is a conflict, not a silent overwrite.
    const dupeRes = await fetch(`${baseUrl}/admin/legal-documents`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({ slug: docSlug, title: "dupe" }),
    });
    assert.equal(dupeRes.status, 409);

    // 2. A draft that has never been published is not reachable publicly.
    const preListRes = await fetch(`${baseUrl}/legal-documents`);
    const preList = (await preListRes.json()) as { documents: { slug: string }[] };
    assert.ok(!preList.documents.some((d) => d.slug === docSlug));
    const preDetailRes = await fetch(`${baseUrl}/legal-documents/${docSlug}`);
    assert.equal(preDetailRes.status, 404);

    // 3. Publish v1.
    const publish1Res = await fetch(`${baseUrl}/admin/legal-documents/${docSlug}/publish`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({}),
    });
    assert.equal(publish1Res.status, 200);
    const publish1Body = (await publish1Res.json()) as { version: { version: number } };
    assert.equal(publish1Body.version.version, 1);

    // 4. The public route now serves v1.
    const afterPublish1 = await fetch(`${baseUrl}/legal-documents/${docSlug}`);
    assert.equal(afterPublish1.status, 200);
    const afterPublish1Body = (await afterPublish1.json()) as {
      document: { version: number; summary: string };
    };
    assert.equal(afterPublish1Body.document.version, 1);
    assert.equal(afterPublish1Body.document.summary, "v1 summary");

    // 5. Edit the draft. The publicly-served v1 must NOT change.
    const editRes = await fetch(`${baseUrl}/admin/legal-documents/${docSlug}`, {
      method: "PUT",
      headers: complianceHeaders(),
      body: JSON.stringify({ summary: "v2 summary (draft only)" }),
    });
    assert.equal(editRes.status, 200);

    const stillV1 = await fetch(`${baseUrl}/legal-documents/${docSlug}`);
    const stillV1Body = (await stillV1.json()) as { document: { version: number; summary: string } };
    assert.equal(stillV1Body.document.version, 1);
    assert.equal(
      stillV1Body.document.summary,
      "v1 summary",
      "editing the draft must not change what is publicly visible",
    );

    // 6. Publish v2. v1's row must remain byte-for-byte unchanged.
    const publish2Res = await fetch(`${baseUrl}/admin/legal-documents/${docSlug}/publish`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({}),
    });
    assert.equal(publish2Res.status, 200);
    const publish2Body = (await publish2Res.json()) as { version: { version: number } };
    assert.equal(publish2Body.version.version, 2);

    const nowV2 = await fetch(`${baseUrl}/legal-documents/${docSlug}`);
    const nowV2Body = (await nowV2.json()) as { document: { version: number; summary: string } };
    assert.equal(nowV2Body.document.version, 2);
    assert.equal(nowV2Body.document.summary, "v2 summary (draft only)");

    const [v1Row] = await db
      .select()
      .from(legalDocumentVersionsTable)
      .where(and(eq(legalDocumentVersionsTable.slug, docSlug), eq(legalDocumentVersionsTable.version, 1)));
    assert.ok(v1Row, "version 1 row must still exist");
    assert.equal(
      v1Row.summary,
      "v1 summary",
      "publishing v2 must not mutate the v1 row",
    );

    // 7. The published list includes this slug exactly once, at v2.
    const listRes = await fetch(`${baseUrl}/legal-documents`);
    const listBody = (await listRes.json()) as { documents: { slug: string; version: number }[] };
    const matches = listBody.documents.filter((d) => d.slug === docSlug);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.version, 2);

    // 8. Exactly one audit row per mutation, with correct before/after.
    const auditRows = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.resourceId, docSlug));
    const byAction = (a: string) => auditRows.filter((r) => r.action === a);
    assert.equal(byAction("legal_documents.create").length, 1);
    assert.equal(byAction("legal_documents.update_draft").length, 1);
    assert.equal(byAction("legal_documents.publish").length, 2);

    const publishRows = byAction("legal_documents.publish").sort((a, b) => a.id - b.id);
    const firstPublishMeta = JSON.parse(publishRows[0]!.meta ?? "{}") as {
      before: { publishedVersionId: number | null };
      after: { version: number };
    };
    assert.equal(firstPublishMeta.before.publishedVersionId, null);
    assert.equal(firstPublishMeta.after.version, 1);
    const secondPublishMeta = JSON.parse(publishRows[1]!.meta ?? "{}") as {
      after: { version: number };
    };
    assert.equal(secondPublishMeta.after.version, 2);
  });

  test("PUT /admin/legal-documents/:slug on an unknown slug is 404", async () => {
    const res = await fetch(`${baseUrl}/admin/legal-documents/${slug("nope")}`, {
      method: "PUT",
      headers: complianceHeaders(),
      body: JSON.stringify({ title: "x" }),
    });
    assert.equal(res.status, 404);
  });

  test("POST /admin/legal-documents/:slug/publish on an unknown slug is 404", async () => {
    const res = await fetch(`${baseUrl}/admin/legal-documents/${slug("nope")}/publish`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 404);
  });

  test("company/entity singleton: rendered on the public list and detail routes, internal columns stripped", async () => {
    const docSlug = slug("company-block");
    CREATED_SLUGS.push(docSlug);

    await fetch(`${baseUrl}/admin/legal-documents`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({ slug: docSlug, title: "Grievance Redressal", summary: "s" }),
    });
    await fetch(`${baseUrl}/admin/legal-documents/${docSlug}/publish`, {
      method: "POST",
      headers: complianceHeaders(),
      body: JSON.stringify({}),
    });

    // Seed (or reuse) the singleton company profile row directly — there is
    // no admin route to write it (see the schema doc comment), only the
    // one-time migration seed populates it in production.
    const existing = await db.select().from(legalCompanyProfileTable).limit(1);
    if (existing.length === 0) {
      createdCompanyProfile = true;
      await db.insert(legalCompanyProfileTable).values({
        legalName: "Test Legal Name Pvt Ltd",
        brand: "TestBrand",
        fssaiLicenseNo: "00000000000000",
        fssaiValidUpto: "[FSSAI licence valid-upto — to be inserted]",
        cin: "[Company CIN — to be inserted]",
        registeredOffice: "[Registered office address — to be inserted]",
        grievanceOfficer: "[Grievance Officer name — to be inserted]",
        grievanceEmail: "grievance@example.test",
        privacyEmail: "grievance@example.test",
        supportEmail: "grievance@example.test",
        supportPhone: "+91 00000 00000",
        serviceAreas: "Test service area",
        jurisdictionCity: "[City — usually the registered-office city]",
        jurisdictionState: "[State], India",
        updatedBy: "system:test",
      });
    }

    const listRes = await fetch(`${baseUrl}/legal-documents`);
    const listBody = (await listRes.json()) as { company: Record<string, unknown> | null };
    assert.ok(listBody.company, "company profile must be present once seeded");
    assert.ok("fssaiLicenseNo" in listBody.company!);
    assert.ok(!("id" in listBody.company!), "internal id column must not be exposed publicly");
    assert.ok(!("singletonKey" in listBody.company!), "internal singletonKey must not be exposed publicly");
    assert.ok(!("updatedBy" in listBody.company!), "operator identity must not be exposed publicly");

    const detailRes = await fetch(`${baseUrl}/legal-documents/${docSlug}`);
    const detailBody = (await detailRes.json()) as { company: Record<string, unknown> | null };
    assert.ok(detailBody.company);
    assert.equal(detailBody.company!["fssaiLicenseNo"], listBody.company!["fssaiLicenseNo"]);
  });
});
