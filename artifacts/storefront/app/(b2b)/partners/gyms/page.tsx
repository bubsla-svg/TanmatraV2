import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { GymRevenueCalculator } from "@/components/landing/GymRevenueCalculator";
import { PartnerLeadForm } from "@/components/partners/PartnerLeadForm";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
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

/**
 * Proof points are limited to facts asserted elsewhere in shipped copy — the
 * kitchen certifications, plus the two structural properties of the partnership
 * the FAQ below already states (no kitchen ops, commission on every active
 * subscription). The previous strip advertised an average partner earning, an
 * onboarding SLA and a member-satisfaction score; none was backed by data — and
 * the earnings figure was a hardcoded amount — so none survived.
 */
const PROOF_ITEMS = [
  { icon: "shield-check" as const, value: "ISO 22000", label: "Certified central kitchen (2018)" },
  { icon: "check" as const, value: "FSSAI", label: "Lic. 22725926001018" },
  { icon: "trend-up" as const, label: "Commission on every active member subscription" },
  { icon: "clock" as const, label: "No kitchen space or meal-handling staff needed" },
];

const FAQ_ITEMS = [
  {
    q: "How does the revenue split and payout work?",
    a: "Commission is computed automatically on every active subscription from your gym members and paid out monthly via direct NEFT transfer.",
  },
  {
    q: "Do we need kitchen space or meal handling staff?",
    a: "Zero operations required on your end. We handle prep in our hygienic central facilities and provide direct last-mile delivery to your members' doorsteps or desks.",
  },
  {
    q: "Can our personal trainers customize meal macros for clients?",
    a: "Yes! Your trainers can coordinate directly with our clinical desk to adjust caloric targets, protein load, and preference overrides.",
  },
];

/** `/partners/gyms` — gym & fitness-centre partnership lander (L-5, Stitch brief
 *  17). The lead form posts to `/partners/leads`, whose schema differs from the
 *  corporate endpoint — see PartnerLeadForm. */
export default function GymsPartnerPage() {
  return (
    // pb-28 reserves room for the fixed StickyCtaBar.
    <div className="mx-auto max-w-5xl px-4 pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero hero={L.hero} ctaLabel="Apply for partnership" ctaHref="#lead-form" />
      <ProofStrip heading="Why fitness clubs partner with Tanmatra" items={PROOF_ITEMS} />
      <BenefitGrid heading={L.benefitsHeading} sub={L.benefitsSub} benefits={L.benefits} />
      <GymRevenueCalculator />

      <section className="py-[var(--space-section)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Integration models</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Flexible integration models</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Choose how you want to partner and scale with Tanmatra.
        </p>
        {/* A rail on mobile, a grid from md — the brief asks for a comparison
            rail rather than a pricing table. */}
        <div className="mt-8 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0">
          {GYM_MODELS.map((m) => (
            <div
              key={m.tag}
              className="w-[85%] shrink-0 snap-center rounded-3xl border border-line bg-surface p-6 md:w-auto"
            >
              <span className="inline-flex rounded-full border border-[var(--gold)]/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-text">
                {m.tag}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{m.body}</p>
              <ul className="mt-5 flex flex-col gap-2 text-sm text-ink">
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

      <section className="border-t border-line py-[var(--space-section)]">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Frequently asked questions</h2>
        <FaqAccordion pageSlug="/partners/gyms" items={FAQ_ITEMS} defaultOpen={null} />
      </section>

      <section id="lead-form" className="scroll-mt-20 border-t border-line py-[var(--space-section)]">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{L.form.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{L.form.blurb}</p>
          <div className="mt-8">
            <PartnerLeadForm
              defaultKind="gym"
              lockKind
              source={L.form.source}
              submitLabel={L.form.submitLabel}
              whatsApp={L.form.whatsApp}
            />
          </div>
        </div>
      </section>

      <StickyCtaBar
        pageSlug="/partners/gyms"
        title="Partner with Tanmatra"
        subtitle="Monetize nutrition with zero operational risk."
        ctaLabel="Apply Now"
        ctaHref="#lead-form"
      />
    </div>
  );
}
