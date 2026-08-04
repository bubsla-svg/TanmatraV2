import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLegalDocument } from "@/lib/legalApi";
import { LegalArticle } from "@/components/legal/LegalArticle";

type Params = { params: Promise<{ slug: string }> };

// ISR, not a static export: a published version must go live without a
// storefront deploy (ADM-20 acceptance). generateStaticParams is
// deliberately NOT used here for the same reason — pre-generating the six
// known slugs at build time would freeze their content at that build.
export const revalidate = 300;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await getLegalDocument(slug);
  if (!lookup.ok) return { title: lookup.reason === "not_found" ? "Not found" : "Legal document" };
  return { title: lookup.doc.title, description: lookup.doc.summary };
}

/** Legal document page, fetched from the Policy/Legal CMS (ADM-20). */
export default async function LegalDocPage({ params }: Params) {
  const { slug } = await params;
  const lookup = await getLegalDocument(slug);
  if (!lookup.ok && lookup.reason === "not_found") notFound();
  if (!lookup.ok) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/legal" className="text-sm text-ink-muted hover:text-ink">
          &larr; Legal &amp; policies
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">This page is briefly unavailable</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            We couldn&rsquo;t reach the document just now — please check back shortly.
          </p>
        </div>
      </section>
    );
  }
  return <LegalArticle doc={lookup.doc} />;
}
