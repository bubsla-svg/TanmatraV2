import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_DOCS, COMPANY } from "@/content/legal";

export const metadata: Metadata = {
  title: "Legal & policies",
  description:
    "Tanmatra's terms, privacy, refund & cancellation, delivery, disclaimer, and grievance policies.",
};

/** Index of all legal documents. */
export default function LegalIndexPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Legal &amp; policies</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        {COMPANY.brand} is operated by {COMPANY.legalName}. Food is prepared under FSSAI Licence
        No. {COMPANY.fssaiLicenseNo}.
      </p>
      <ul className="mt-8 border-t border-line">
        {LEGAL_DOCS.map((d) => (
          <li key={d.slug} className="border-b border-line">
            <Link href={`/legal/${d.slug}`} className="flex flex-col gap-1 px-1 py-4 hover:bg-surface">
              <span className="text-base font-semibold text-ink">{d.title}</span>
              <span className="max-w-prose text-sm text-ink-muted">{d.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
