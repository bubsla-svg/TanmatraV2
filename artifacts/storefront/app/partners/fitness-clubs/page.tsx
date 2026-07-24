import type { Metadata } from "next";
import Link from "next/link";
import { LandingHero } from "@/components/landing/LandingHero";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { FITNESS_LANDING as L, FITNESS_MENU } from "@/content/landing/partners";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = {
  title: L.metaTitle,
  description: L.metaDescription,
  alternates: { canonical: "/partners/fitness-clubs" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: L.metaTitle,
  description: L.metaDescription,
  url: `${SITE_URL}/partners/fitness-clubs`,
};

/** `/partners/fitness-clubs` — morning running/cycling-club lander (route-parity
 *  Wave B). Static marketing; the lead form POSTs to /corporate-leads tagged
 *  kind=fitness_club. Dish macros are illustrative — the live menu is /menu. */
export default function FitnessClubsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero hero={L.hero} ctaLabel="Register your club" ctaHref="#lead-form" />
      <BenefitGrid heading={L.benefitsHeading} sub={L.benefitsSub} benefits={L.benefits} />

      <section className="py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Perfect post-run fuel</h2>
            <p className="mt-2 text-sm text-ink-muted">A sneak peek at our popular recovery breakfast options.</p>
          </div>
          <Link href="/menu" className="shrink-0 text-sm font-semibold text-gold-text hover:underline">
            Full menu &rarr;
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {FITNESS_MENU.map((d) => (
            <div key={d.name} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink">{d.name}</h3>
              <p className="tabular mt-1 text-[11px] font-medium text-gold-text">{d.macros}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="lead-form" className="border-t border-line py-12">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{L.form.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{L.form.blurb}</p>
          <div className="mt-6">
            <CorporateLeadForm
              defaultKind={L.form.kind}
              lockKind
              source={L.form.source}
              submitLabel={L.form.submitLabel}
              whatsApp={L.form.whatsApp}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
