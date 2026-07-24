import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_BY_SLUG, LEGAL_DOCS } from "@/content/legal";
import { LegalArticle } from "@/components/legal/LegalArticle";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_BY_SLUG[slug];
  if (!doc) return { title: "Not found" };
  return { title: doc.title, description: doc.summary };
}

/** Static legal document page. Indexable (these help trust + SEO). */
export default async function LegalDocPage({ params }: Params) {
  const { slug } = await params;
  const doc = LEGAL_BY_SLUG[slug];
  if (!doc) notFound();
  return <LegalArticle doc={doc} />;
}
