import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { SubsidyCalculator } from "@/components/landing/SubsidyCalculator";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
import { fetchMenu } from "@/lib/catalog";
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

export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: CORPORATE_META.title,
  description: CORPORATE_META.description,
  url: `${SITE_URL}/corporate-wellness`,
};

/** `/corporate-wellness` — HR-facing team-lunch lander (route-parity Wave B,
 *  Stitch brief 14 — also the page that defines the shared landing kit).
 *  Static marketing + one subsidy-ESTIMATOR island; the lead form POSTs to the
 *  existing /corporate-leads endpoint tagged kind=corporate.
 *
 *  Section order is fixed by the brief: hero → pain tiles → how it works →
 *  subsidy estimator → differentiators → delivery chips → pilot lead form →
 *  HR FAQ. The hero photo is a real dish off the live menu rather than office
 *  stock; `fetchMenu` falls back to the bundled catalogue and never throws, so
 *  a menu outage degrades to the text-only hero instead of a 500. */
export default async function CorporateWellnessPage() {
  const { dishes } = await fetchMenu();
  const heroDish = dishes.find((d) => d.image);

  return (
    // pb-28 reserves room for the fixed StickyCtaBar so the FAQ stays reachable.
    <div
      data-ui-generation="stitch-74"
      data-screen-id="12.2"
      data-screen-state="default"
      className="mx-auto max-w-5xl px-4 pb-28"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero
        hero={CORPORATE_HERO}
        ctaLabel="Book a 20-min pilot call"
        ctaHref="#pilot-form"
        secondaryCta={{ label: "See how it works", href: "#how-it-works" }}
        image={heroDish ? { src: heroDish.image, alt: heroDish.name } : undefined}
      />
      <BenefitGrid
        variant="tiles"
        eyebrow="The math HR already knows"
        heading="Three line items nobody budgets for"
        benefits={PAIN_TILES}
      />
      <BenefitGrid
        variant="steps"
        id="how-it-works"
        eyebrow="Built on the live product"
        heading="How it works for teams"
        benefits={HOW_IT_WORKS}
      />
      <SubsidyCalculator />
      <BenefitGrid
        eyebrow="Not a caterer"
        heading="A clinical kitchen, not a buffet counter"
        benefits={DIFFERENTIATORS}
      />

      <section className="py-[var(--space-section)]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
          Where we already deliver daily
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DELIVERY_DESTINATIONS.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs text-ink-muted"
            >
              <LandingIcon name="map-pin" className="h-3.5 w-3.5 text-gold-text" />
              {d}
            </span>
          ))}
        </div>
      </section>

      <section id="pilot-form" className="scroll-mt-20 border-t border-line py-[var(--space-section)]">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Pilot pricing</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{F.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{F.blurb}</p>
          <div className="mt-8">
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

      <section className="border-t border-line py-[var(--space-section)]">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">What HR asks us</h2>
        {/* Landers open fully collapsed (brief 14) and report faq_open. */}
        <FaqAccordion items={CORPORATE_FAQ} pageSlug="/corporate-wellness" defaultOpen={null} />
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
