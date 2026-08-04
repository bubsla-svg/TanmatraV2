import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
import { PartnerLeadForm } from "@/components/partners/PartnerLeadForm";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = {
  title: "Clinical Dietitian Network & Meal Formulation Partners | Tanmatra",
  description:
    "Partner with Tanmatra to deliver therapeutic, macro-precise nutrition directly to your clinical patients with automated contraindication safety gates.",
  alternates: { canonical: "/partners/dietitians" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Clinical Dietitian Network & Meal Formulation Partners",
  description:
    "Partner with Tanmatra to deliver therapeutic, macro-precise nutrition directly to your clinical patients with automated contraindication safety gates.",
  url: `${SITE_URL}/partners/dietitians`,
};

const HERO_DATA = {
  eyebrow: "Clinical Advisory & Patient Formulation",
  title: "Therapeutic Meal Adherence for",
  accent: "Clinical Dietitians",
  subtitle:
    "Extend your dietary protocols beyond paper prescriptions. Our hospital-grade hygienic facility prepares and delivers your exact caloric, macronutrient, and therapeutic formulas directly to your patients.",
  trust: [
    { icon: "shield-check" as const, label: "Automated contraindication screening" },
    { icon: "clipboard" as const, label: "IDA / RD verified roster only" },
  ],
};

/**
 * Proof points describe verifiable credentials and the mechanisms this page's
 * own FAQ explains. The previous strip claimed "FSSAI & NABL", "100%" protocol
 * compliance, "50+ RDs" and a "<12h" activation SLA — a partner count, an SLA
 * and an absolute compliance rate, none backed by data, plus an accreditation
 * body (NABL) asserted nowhere else in the repo. Aimed at regulated clinicians,
 * those are the highest-risk claims on the surface, so none survived.
 */
const PROOF_ITEMS = [
  { icon: "shield-check" as const, value: "ISO 22000", label: "Certified central kitchen (2018)" },
  { icon: "clipboard" as const, value: "FSSAI", label: "Lic. 22725926001018" },
  { icon: "users" as const, label: "Registered dietitians and clinical nutritionists only" },
  { icon: "clock" as const, label: "Macro targets adjustable mid-cycle, effective next day" },
];

const CLINICAL_PILLARS = [
  {
    tag: "Patient Adherence",
    title: "End-to-End Meal Compliance",
    body: "Eliminate home kitchen calculation errors. We weigh and cook portions to match your exact macro split prescriptions.",
  },
  {
    tag: "Safety Gates",
    title: "Contraindication Screening",
    body: "Our therapeutic engine automatically flags and filters dishes conflicting with PCOS, thyroid, diabetes, or hypertensive profiles.",
  },
  {
    tag: "Honorarium System",
    title: "Recurring Formulation Payouts",
    body: "Earn predictable consultative honorariums for every patient subscribed to your validated nutritional regimens.",
  },
  {
    tag: "Collaborative Care",
    title: "Real-Time Macro Adjustments",
    body: "Modify targets mid-cycle as your patient's lab panels and metabolic responses progress over treatment phases.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How are contraindications and food allergies verified before cooking?",
    a: "Every patient formulation runs through our therapeutic governance engine against known allergies and medical profiles before our culinary desk begins preparation.",
  },
  {
    q: "What is the requirement for the IDA / RD license registration number?",
    a: "To maintain strict clinical integrity, we only enroll certified registered dietitians and clinical nutritionists. Your license number is verified against medical registries by our partnership committee.",
  },
  {
    q: "Can I adjust macronutrient targets mid-cycle if a patient's metabolic response shifts?",
    a: "Absolutely. You can modify macro split targets or therapeutic exclusions through the partner desk at any time with immediate effect on next-day preparation.",
  },
];

/** `/partners/dietitians` — clinical dietitian partnership lander (L-6; Stitch
 *  brief 17 — inherits the /partners/gyms design). The lead form posts to
 *  /partners/leads as kind=rd, which makes rdRegNo required and format-checked. */
export default function DietitiansPartnerPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingHero hero={HERO_DATA} ctaLabel="Apply for clinical accreditation" ctaHref="#rd-apply" />
      <ProofStrip heading="Clinical integrity powered by Tanmatra" items={PROOF_ITEMS} />

      <section className="py-[var(--space-section)]">
        <h2 className="text-2xl font-semibold tracking-tight text-ink text-center sm:text-3xl">
          Designed for clinical rigor
        </h2>
        <p className="mt-2 text-center text-sm text-ink-muted">
          Why leading registered dietitians prescribe Tanmatra meal formulations.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {CLINICAL_PILLARS.map((item) => (
            <div key={item.tag} className="rounded-3xl border border-line bg-surface p-6">
              <span className="inline-flex rounded-full border border-[var(--gold)]/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold-text">
                {item.tag}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-[var(--space-section)]">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Frequently Asked Questions</h2>
        <FaqAccordion pageSlug="/partners/dietitians" items={FAQ_ITEMS} defaultOpen={null} />
      </section>

      <section id="rd-apply" className="scroll-mt-20 border-t border-line py-[var(--space-section)]">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Clinical partner accreditation
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Enter your practice details and IDA / RD licence number to start credential verification.
          </p>
          <div className="mt-8">
            <PartnerLeadForm
              defaultKind="rd"
              lockKind
              source="web:/partners/dietitians"
              submitLabel="Submit licence for review"
            />
          </div>
        </div>
      </section>

      <StickyCtaBar
        pageSlug="/partners/dietitians"
        title="Clinical Dietitian Network"
        subtitle="Deliver therapeutic macro adherence to your patients."
        ctaLabel="Apply Now"
        ctaHref="#rd-apply"
      />
    </div>
  );
}
