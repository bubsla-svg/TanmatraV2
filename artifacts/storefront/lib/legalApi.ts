/**
 * Legal/Policy CMS client (ADM-20). The api-server exposes PUBLIC, read-only
 * endpoints — `GET /api/legal-documents` (list, title/summary only) and
 * `GET /api/legal-documents/:slug` (full body) — both also returning the
 * `legal_company_profile` singleton (entity name, FSSAI licence, contacts).
 * Server components call these directly via API_BASE_URL, same pattern as
 * lib/recipesApi.ts; a cold/unreachable API degrades to []/null so a page
 * renders its own empty/not-found state instead of throwing. Fetches use a
 * short ISR window (not `force-cache`) so publishing a new version — or
 * editing the company profile — is live on the next revalidation with no
 * storefront deploy.
 */
// Relative, not "@/..." — lib/ files run directly under node:test (no path-
// alias resolution there), so an "@/" import here 404s at test time despite
// a clean typecheck/build. See CLAUDE.md's "no-@/-alias rule" for lib/.
import type { LegalDoc, LegalSection } from "../content/legal/types";

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

/** Every published legal document (title/summary only — no body, matching
 *  what /legal's index actually renders) plus the company/entity singleton.
 *  Degrades to `{documents: [], company: null}` on any failure. */
export async function getLegalDocuments(fetchImpl: FetchImpl = fetch): Promise<LegalDocumentsList> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/legal-documents`, REVALIDATE);
    if (!res.ok) throw new Error(`legal-documents ${res.status}`);
    const data = (await res.json()) as {
      documents?: WireDocumentSummary[];
      company?: CompanyProfile | null;
    };
    return { documents: (data.documents ?? []).map(toLegalDocHeader), company: data.company ?? null };
  } catch {
    return { documents: [], company: null };
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
 * singleton. Distinguishes "no such slug, or a draft never published" from
 * "couldn't reach the api" — same reasoning as recipesApi's
 * `getRecipeOrReason`: collapsing both to a 404 would turn a transient API
 * outage into a real page reading as permanently gone.
 */
export async function getLegalDocument(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<LegalDocumentResult> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/legal-documents/${encodeURIComponent(slug)}`, REVALIDATE);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as {
      document?: WireDocumentDetail;
      company?: CompanyProfile | null;
    };
    if (!data.document) return { ok: false, reason: "not_found" };
    const doc: LegalDoc = { ...toLegalDocHeader(data.document), sections: data.document.body };
    return { ok: true, doc, company: data.company ?? null };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
