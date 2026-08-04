import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLegalDocuments } from "@/lib/legalApi";
import { LegalMasthead } from "@/components/legal/LegalMasthead";

export const metadata: Metadata = {
  title: "Legal & policies",
  description:
    "Tanmatra's terms, privacy, refund & cancellation, delivery, disclaimer, and grievance policies.",
};

// ISR, not static: the list (and the FSSAI/entity line below) reflects
// whatever is currently published, no deploy required (ADM-20 acceptance).
export const revalidate = 300;

/** Index of every published legal document, from the Policy/Legal CMS (ADM-20). */
const FALLBACK_DEK =
  "Tanmatra's terms, privacy, refund & cancellation, delivery, disclaimer, and grievance policies.";

export default async function LegalIndexPage() {
  const { documents, company } = await getLegalDocuments();
  const dek = company
    ? `${company.brand} is operated by ${company.legalName}. Food is prepared under FSSAI Licence No. ${company.fssaiLicenseNo}.`
    : FALLBACK_DEK;

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <LegalMasthead eyebrow="Legal" title="Legal & policies" dek={dek} />
      <ul className="mt-8 flex flex-col gap-3">
        {documents.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/legal/${d.slug}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 hover:bg-surface-raised"
            >
              <div className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{d.title}</span>
                <span className="mt-1 block max-w-prose text-sm text-ink-muted">{d.summary}</span>
              </div>
              <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
