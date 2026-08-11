/**
 * Legal/Policy CMS client wire contract (injected fetch, no network).
 * Verifies the endpoint URLs, the {documents,company}/{document,company}
 * unwrapping, the 404 -> not_found path — and, since the CRT-28 repair, the
 * STATIC FALLBACK: production 2026-08-11 served `{"documents":[],"company":
 * null}` (unseeded table) while every footer/account-sheet legal link 404'd,
 * so a CMS with nothing to say must degrade to the bundled content/legal
 * registry, never to an empty index or a 404 on a statutory page.
 * Run: node --test --import tsx ./lib/legalApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getLegalDocuments, getLegalDocument, getCompanyProfile } from "./legalApi";
import { LEGAL_DOCS } from "../content/legal/index";

const SAMPLE_COMPANY = {
  legalName: "Trending Media Service Private Limited",
  brand: "Tanmatra",
  fssaiLicenseNo: "22725926001018",
  fssaiValidUpto: "[FSSAI licence valid-upto — to be inserted]",
  cin: "[Company CIN — to be inserted]",
  registeredOffice: "[Registered office address — to be inserted]",
  grievanceOfficer: "[Grievance Officer name — to be inserted]",
  grievanceEmail: "grievance@tanmatra.food",
  privacyEmail: "grievance@tanmatra.food",
  supportEmail: "grievance@tanmatra.food",
  supportPhone: "+91 92892 13115",
  serviceAreas: "Noida and surrounding serviceable pincodes (Delhi NCR)",
  jurisdictionCity: "[City — usually the registered-office city]",
  jurisdictionState: "[State], India",
  updatedAt: "2026-07-24T00:00:00.000Z",
};

const SAMPLE_SUMMARY = {
  slug: "terms",
  title: "Terms of Service",
  summary: "The terms on which you use Tanmatra.",
  version: 1,
  effectiveFrom: "2026-07-24T00:00:00.000Z",
  publishedAt: "2026-07-24T10:00:00.000Z",
};

interface Call {
  url: string;
}
function jsonFetch(calls: Call[], body: unknown, status = 200): typeof fetch {
  return (async (url: unknown) => {
    calls.push({ url: String(url) });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
}

const failingFetch = (async () => {
  throw new Error("network down");
}) as unknown as typeof fetch;

test("getLegalDocuments: GETs /api/legal-documents and unwraps {documents, company}", async () => {
  const calls: Call[] = [];
  const out = await getLegalDocuments(
    jsonFetch(calls, { documents: [SAMPLE_SUMMARY], company: SAMPLE_COMPANY }),
  );
  assert.match(calls[0]!.url, /\/api\/legal-documents$/);
  assert.equal(out.documents.length, 1);
  assert.equal(out.documents[0]!.slug, "terms");
  assert.equal(out.documents[0]!.title, "Terms of Service");
  assert.equal(out.company?.fssaiLicenseNo, "22725926001018");
});

test("getLegalDocuments: formats effectiveFrom into a human 'updated' label", async () => {
  const out = await getLegalDocuments(jsonFetch([], { documents: [SAMPLE_SUMMARY], company: null }));
  assert.equal(out.documents[0]!.updated, "24 July 2026");
});

test("getLegalDocuments: an unseeded CMS (empty documents) serves the bundled registry", async () => {
  const { documents, company } = await getLegalDocuments(
    jsonFetch([], { documents: [], company: null }),
  );
  assert.equal(documents.length, LEGAL_DOCS.length);
  assert.ok(documents.some((d) => d.slug === "terms"));
  assert.ok(company, "company/entity block must come from the bundle too");
  assert.equal(company.fssaiLicenseNo, "22725926001018");
});

test("getLegalDocuments: a failed fetch serves the bundled registry, not an empty index", async () => {
  const { documents, company } = await getLegalDocuments(failingFetch);
  assert.equal(documents.length, LEGAL_DOCS.length);
  assert.equal(company?.brand, "Tanmatra");
});

test("getCompanyProfile: returns the company from the list endpoint", async () => {
  const calls: Call[] = [];
  const out = await getCompanyProfile(jsonFetch(calls, { documents: [SAMPLE_SUMMARY], company: SAMPLE_COMPANY }));
  assert.match(calls[0]!.url, /\/api\/legal-documents$/);
  assert.equal(out?.brand, "Tanmatra");
});

test("getCompanyProfile: bundled company when the api is unreachable", async () => {
  const out = await getCompanyProfile(failingFetch);
  assert.equal(out?.fssaiLicenseNo, "22725926001018");
});

test("getLegalDocument: GETs /api/legal-documents/:slug and unwraps {document, company} into sections", async () => {
  const calls: Call[] = [];
  const body = { ...SAMPLE_SUMMARY, body: [{ heading: "1. About", body: ["Some prose."] }] };
  const out = await getLegalDocument(
    "terms",
    jsonFetch(calls, { document: body, company: SAMPLE_COMPANY }),
  );
  assert.match(calls[0]!.url, /\/api\/legal-documents\/terms$/);
  assert.deepEqual(out, {
    ok: true,
    doc: {
      slug: "terms",
      title: "Terms of Service",
      summary: "The terms on which you use Tanmatra.",
      updated: "24 July 2026",
      sections: [{ heading: "1. About", body: ["Some prose."] }],
    },
    company: SAMPLE_COMPANY,
  });
});

test("getLegalDocument: 404 resolves to {ok:false, reason:'not_found'} for a slug in neither the CMS nor the bundle", async () => {
  const out = await getLegalDocument("unpublished-slug", jsonFetch([], { error: "not found" }, 404));
  assert.deepEqual(out, { ok: false, reason: "not_found" });
});

test("getLegalDocument: a CMS 404 for a bundled slug serves the bundled document", async () => {
  const out = await getLegalDocument("terms", jsonFetch([], { error: "not found" }, 404));
  assert.ok(out.ok, "bundled statutory doc must render despite the CMS 404");
  assert.equal(out.doc.slug, "terms");
  assert.ok(out.doc.sections.length > 0);
});

test("getLegalDocument: a 500 for a bundled slug serves the bundled document", async () => {
  const out = await getLegalDocument("privacy", jsonFetch([], { error: "boom" }, 500));
  assert.ok(out.ok);
  assert.equal(out.doc.slug, "privacy");
});

test("getLegalDocument: a 500 for a non-bundled slug is reason:'unavailable', distinct from not_found", async () => {
  const out = await getLegalDocument("unpublished-slug", jsonFetch([], { error: "boom" }, 500));
  assert.deepEqual(out, { ok: false, reason: "unavailable" });
});

test("getLegalDocument: a network failure for a non-bundled slug is reason:'unavailable', not not_found", async () => {
  const out = await getLegalDocument("unpublished-slug", failingFetch);
  assert.deepEqual(out, { ok: false, reason: "unavailable" });
});

test("getLegalDocument: a network failure for a bundled slug serves the bundled document", async () => {
  const out = await getLegalDocument("grievance", failingFetch);
  assert.ok(out.ok);
  assert.equal(out.doc.slug, "grievance");
});

test("getLegalDocument: slug is URL-encoded", async () => {
  const calls: Call[] = [];
  await getLegalDocument(
    "weird slug/x",
    jsonFetch(calls, { document: { ...SAMPLE_SUMMARY, slug: "weird slug/x", body: [] }, company: null }),
  );
  assert.match(calls[0]!.url, /\/api\/legal-documents\/weird%20slug%2Fx$/);
});
