import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/content/faq";
import { FaqAccordion } from "@/components/faq/FaqAccordion";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about ordering, delivery, subscriptions, payments, allergens, and Tanmatra's therapeutic meal programme.",
};

// FAQPage structured data (rich-result eligibility), built from the same list.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FaqPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Help centre</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        Frequently asked questions
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Everything you need to know about ordering, delivery, and our therapeutic meal programme.
      </p>

      <FaqAccordion items={FAQS} />

      <div className="mt-8 flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Still have questions?</p>
          <p className="mt-0.5 text-xs text-ink-muted">Book a 1-on-1 with a registered dietitian.</p>
        </div>
        <Link
          href="/rd"
          className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Talk to an RD
        </Link>
      </div>
    </section>
  );
}
