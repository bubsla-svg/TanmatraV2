import type { LegalDoc } from "./types";
import { privacyDoc } from "./privacy";
import { termsDoc } from "./terms";
import { refundsDoc } from "./refunds";
import { shippingDoc } from "./shipping";
import { disclaimerDoc } from "./disclaimer";
import { grievanceDoc } from "./grievance";

/**
 * Registry of every legal document. Order here drives the /legal index and the
 * footer link list. Consumed by app/legal/[slug] (generateStaticParams) and
 * the Footer; a future sitemap entry can iterate LEGAL_DOCS too.
 */
export const LEGAL_DOCS: LegalDoc[] = [
  termsDoc,
  privacyDoc,
  refundsDoc,
  shippingDoc,
  disclaimerDoc,
  grievanceDoc,
];

export const LEGAL_BY_SLUG: Record<string, LegalDoc> = Object.fromEntries(
  LEGAL_DOCS.map((d) => [d.slug, d]),
);

export type { LegalDoc, LegalSection } from "./types";
export { COMPANY } from "./company";
