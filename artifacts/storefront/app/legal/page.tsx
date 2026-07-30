import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LEGAL_DOCS, COMPANY } from "@/content/legal";
import { LegalMasthead } from "@/components/legal/LegalMasthead";

export const metadata: Metadata = {
  title: "Legal & policies",
  description:
    "Tanmatra's terms, privacy, refund & cancellation, delivery, disclaimer, and grievance policies.",
};

/** Index of all legal documents. */
export default function LegalIndexPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <LegalMasthead
        eyebrow="Legal"
        title="Legal & policies"
        dek={`${COMPANY.brand} is operated by ${COMPANY.legalName}. Food is prepared under FSSAI Licence No. ${COMPANY.fssaiLicenseNo}.`}
      />
      <ul className="mt-8 flex flex-col gap-3">
        {LEGAL_DOCS.map((d) => (
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
