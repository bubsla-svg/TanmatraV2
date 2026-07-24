import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { GymRevenueCalculator } from "@/components/landing/GymRevenueCalculator";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { GYMS_LANDING as L, GYM_MODELS } from "@/content/landing/partners";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = {
  title: L.metaTitle,
  description: L.metaDescription,
  alternates: { canonical: "/partners/gyms" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: L.metaTitle,
  description: L.metaDescription,
  url: `${SITE_URL}/partners/gyms`,
};

/** `/partners/gyms` — gym & fitness-centre partnership lander (route-parity
 *  Wave B). Static marketing + one interactive estimator island; the lead form
 *  POSTs to the existing /corporate-leads endpoint tagged kind=gym. */
export default function GymsPartnerPage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero hero={L.hero} ctaLabel="Apply for partnership" ctaHref="#lead-form" />
      <BenefitGrid heading={L.benefitsHeading} sub={L.benefitsSub} benefits={L.benefits} />
      <GymRevenueCalculator />

      <section className="py-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Flexible integration models</h2>
        <p className="mt-2 text-sm text-ink-muted">Choose how you want to partner and scale with Tanmatra.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {GYM_MODELS.map((m) => (
            <div key={m.tag} className="rounded-2xl border border-line bg-surface p-6">
              <span className="inline-flex rounded-md bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-text">
                {m.tag}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{m.body}</p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-ink">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden="true" className="text-sage">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
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
