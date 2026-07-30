import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { GymRevenueCalculator } from "@/components/landing/GymRevenueCalculator";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
import { GYMS_LANDING as L, GYM_MODELS } from "@/content/landing/partners";
import { SITE_URL } from "@/lib/siteUrl";
import { formatPaise } from "@/lib/format";

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

const PROOF_ITEMS = [
  { icon: "trend-up" as const, value: `${formatPaise(4500000)}+/mo`, label: "Avg. Partner Earnings" },
  { icon: "shield-check" as const, value: "100%", label: "Zero Inventory & Operational Risk" },
  { icon: "clock" as const, value: "<24h", label: "Partner Desk Onboarding" },
  { icon: "check" as const, value: "4.8★", label: "Member Meal Satisfaction" },
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

/** `/partners/gyms` — gym & fitness-centre partnership lander (L-5). */
export default function GymsPartnerPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero hero={L.hero} ctaLabel="Apply for partnership" ctaHref="#lead-form" />
      <ProofStrip heading="Why top fitness clubs partner with Tanmatra" items={PROOF_ITEMS} />
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

      <section className="border-t border-line py-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Frequently Asked Questions</h2>
        <FaqAccordion pageSlug="/partners/gyms" items={FAQ_ITEMS} defaultOpen={null} />
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

