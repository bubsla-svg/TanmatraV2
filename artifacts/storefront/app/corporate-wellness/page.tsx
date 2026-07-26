import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { SubsidyCalculator } from "@/components/landing/SubsidyCalculator";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
import { SITE_URL } from "@/lib/siteUrl";
import {
  CORPORATE_META,
  CORPORATE_HERO,
  PAIN_TILES,
  HOW_IT_WORKS,
  DIFFERENTIATORS,
  DELIVERY_DESTINATIONS,
  CORPORATE_FAQ,
  CORPORATE_FORM as F,
} from "@/content/landing/corporate";

export const metadata: Metadata = {
  title: CORPORATE_META.title,
  description: CORPORATE_META.description,
  alternates: { canonical: "/corporate-wellness" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: CORPORATE_META.title,
  description: CORPORATE_META.description,
  url: `${SITE_URL}/corporate-wellness`,
};

/** `/corporate-wellness` — HR-facing team-lunch lander (route-parity Wave B).
 *  Static marketing + one subsidy-estimator island; the lead form POSTs to the
 *  existing /corporate-leads endpoint tagged kind=corporate. */
export default function CorporateWellnessPage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero
        hero={CORPORATE_HERO}
        ctaLabel="Book a 20-min pilot call"
        ctaHref="#pilot-form"
        secondaryCta={{ label: "See how it works", href: "#how-it-works" }}
      />
      <BenefitGrid eyebrow="The math HR already knows" heading="Three line items nobody budgets for" benefits={PAIN_TILES} />
      <BenefitGrid id="how-it-works" eyebrow="Built on the live product" heading="How it works for teams" benefits={HOW_IT_WORKS} />
      <SubsidyCalculator />
      <BenefitGrid eyebrow="Not a caterer" heading="A clinical kitchen, not a buffet counter" benefits={DIFFERENTIATORS} />

      <section className="py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Where we already deliver daily</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DELIVERY_DESTINATIONS.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs text-ink-muted">
              <LandingIcon name="map-pin" className="h-3.5 w-3.5 text-gold-text" />
              {d}
            </span>
          ))}
        </div>
      </section>

      <section id="pilot-form" className="scroll-mt-20 border-t border-line py-12">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Pilot pricing</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{F.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{F.blurb}</p>
          <div className="mt-6">
            <CorporateLeadForm
              defaultKind={F.kind}
              lockKind
              source={F.source}
              submitLabel={F.submitLabel}
              whatsApp={F.whatsApp}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">What HR asks us</h2>
        <FaqAccordion items={CORPORATE_FAQ} />
      </section>

      <StickyCtaBar
        pageSlug="/corporate-wellness"
        title="Corporate Team Wellness"
        subtitle="Custom pilot pricing for office lunches & subsidies."
        ctaLabel="Book Pilot Call"
        ctaHref="#pilot-form"
      />
    </div>
  );
}
