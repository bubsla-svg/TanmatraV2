/**
 * Legal/Policy CMS client (ADM-20). The api-server exposes PUBLIC, read-only
 * endpoints — `GET /api/legal-documents` (list, title/summary only) and
 * `GET /api/legal-documents/:slug` (full body) — both also returning the
 * `legal_company_profile` singleton (entity name, FSSAI licence, contacts).
 * Server components call these directly via API_BASE_URL, same pattern as
 * lib/recipesApi.ts. Fetches use a short ISR window (not `force-cache`) so
 * publishing a new version — or editing the company profile — is live on the
 * next revalidation with no storefront deploy.
 *
 * STATIC FALLBACK: when the CMS has nothing to say — unreachable, or its
 * `legal_documents` table is simply unseeded (production 2026-08-11:
 * `{"documents":[],"company":null}`) — these functions serve the bundled
 * content/legal documents instead. Terms, privacy, refunds, shipping,
 * disclaimer and grievance are statutory disclosures for an Indian
 * food-delivery business; an empty CMS must degrade to the reviewed bundled
 * copy, never to a 404. Same doctrine as the menu's STATIC_DISHES fallback.
 * A live CMS with published documents always wins.
 */
// Relative, not "@/..." — lib/ files run directly under node:test (no path-
// alias resolution there), so an "@/" import here 404s at test time despite
// a clean typecheck/build. See CLAUDE.md's "no-@/-alias rule" for lib/.
import type { LegalDoc, LegalSection } from "../content/legal/types";
import { LEGAL_DOCS, LEGAL_BY_SLUG, COMPANY } from "../content/legal/index";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

/** Injectable fetch so the wire contract is testable without a network. */
export type FetchImpl = typeof fetch;

export interface CompanyProfile {
  legalName: string;
  brand: string;
  fssaiLicenseNo: string;
  fssaiValidUpto: string;
  cin: string;
  registeredOffice: string;
  grievanceOfficer: string;
  grievanceEmail: string;
  privacyEmail: string;
  supportEmail: string;
  supportPhone: string;
  serviceAreas: string;
  jurisdictionCity: string;
  jurisdictionState: string;
  updatedAt: string;
}

interface WireDocumentSummary {
  slug: string;
  title: string;
  summary: string;
  version: number;
  effectiveFrom: string;
  publishedAt: string;
}

interface WireDocumentDetail extends WireDocumentSummary {
  body: LegalSection[];
}

// Short ISR window, not force-cache: legal content can change without a
// deploy, but every page rendering the Footer's entity block does not need
// to hit the api-server on every single request either.
const REVALIDATE = { next: { revalidate: 300 } } as RequestInit;

/** "24 July 2026" — matches the human label the migrated content used to
 *  carry as a literal string (content/legal/company.ts's `updated` field). */
function formatUpdated(effectiveFrom: string): string {
  const d = new Date(effectiveFrom);
  if (Number.isNaN(d.getTime())) return effectiveFrom;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function toLegalDocHeader(doc: WireDocumentSummary): Omit<LegalDoc, "sections"> {
  return { slug: doc.slug, title: doc.title, summary: doc.summary, updated: formatUpdated(doc.effectiveFrom) };
}

export interface LegalDocumentsList {
  documents: Omit<LegalDoc, "sections">[];
  company: CompanyProfile | null;
}

/** The bundled content/legal registry in the wire's shape — served whenever
 *  the CMS is unreachable or unseeded. */
function staticCompanyProfile(): CompanyProfile {
  return {
    legalName: COMPANY.legalName,
    brand: COMPANY.brand,
    fssaiLicenseNo: COMPANY.fssaiLicenseNo,
    fssaiValidUpto: "",
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
    updatedAt: COMPANY.updated,
  };
}

function staticDocumentsList(): LegalDocumentsList {
  return {
    documents: LEGAL_DOCS.map(({ slug, title, summary, updated }) => ({ slug, title, summary, updated })),
    company: staticCompanyProfile(),
  };
}

/** Every published legal document (title/summary only — no body, matching
 *  what /legal's index actually renders) plus the company/entity singleton.
 *  An unreachable OR unseeded CMS degrades to the bundled content/legal
 *  registry — the statutory pages must always have something to render. */
export async function getLegalDocuments(fetchImpl: FetchImpl = fetch): Promise<LegalDocumentsList> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/legal-documents`, REVALIDATE);
    if (!res.ok) throw new Error(`legal-documents ${res.status}`);
    const data = (await res.json()) as {
      documents?: WireDocumentSummary[];
      company?: CompanyProfile | null;
    };
    if (!data.documents || data.documents.length === 0) return staticDocumentsList();
    return { documents: data.documents.map(toLegalDocHeader), company: data.company ?? staticCompanyProfile() };
  } catch {
    return staticDocumentsList();
  }
}

/** Company/entity singleton alone (FSSAI licence, registered office, …) —
 *  for chrome like the Footer that needs it on every page but not the
 *  document list. There is no separate endpoint for it (the runbook specs
 *  exactly the two document routes), so this wraps `getLegalDocuments`. */
export async function getCompanyProfile(fetchImpl?: FetchImpl): Promise<CompanyProfile | null> {
  const { company } = await getLegalDocuments(fetchImpl);
  return company;
}

export type LegalDocumentResult =
  | { ok: true; doc: LegalDoc; company: CompanyProfile | null }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * One published document by slug, full body included, plus the company
 * singleton. A CMS miss (404, outage, or an unseeded table) falls back to
 * the bundled content/legal document for that slug before reporting
 * not_found/unavailable — a statutory page must never read as gone just
 * because the CMS has not been seeded. A slug in neither the CMS nor the
 * bundle is a genuine not_found (→ the route's notFound()).
 */
export async function getLegalDocument(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<LegalDocumentResult> {
  const staticDoc = LEGAL_BY_SLUG[slug];
  const staticResult: LegalDocumentResult | null = staticDoc
    ? { ok: true, doc: staticDoc, company: staticCompanyProfile() }
    : null;
  try {
    const res = await fetchImpl(`${API_BASE}/api/legal-documents/${encodeURIComponent(slug)}`, REVALIDATE);
    if (res.status === 404) return staticResult ?? { ok: false, reason: "not_found" };
    if (!res.ok) return staticResult ?? { ok: false, reason: "unavailable" };
    const data = (await res.json()) as {
      document?: WireDocumentDetail;
      company?: CompanyProfile | null;
    };
    if (!data.document) return staticResult ?? { ok: false, reason: "not_found" };
    const doc: LegalDoc = { ...toLegalDocHeader(data.document), sections: data.document.body };
    return { ok: true, doc, company: data.company ?? null };
  } catch {
    return staticResult ?? { ok: false, reason: "unavailable" };
  }
}
