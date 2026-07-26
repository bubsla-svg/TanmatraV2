import Link from "next/link";
import { cookies } from "next/headers";
import { ConsumerPlansGrid } from "@/components/landing/ConsumerPlansGrid";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";
import { formatPaise } from "@/lib/format";

const PROOF_ITEMS = [
  { icon: "check" as const, value: "40-45m", label: "Punctual Hot Desk Delivery" },
  { icon: "shield-check" as const, value: "100%", label: "Verified Macros & Zero Industrial Oil" },
  { icon: "users" as const, value: "Noida", label: "Active Enterprise Park Coverage" },
  { icon: "trend-up" as const, value: `${formatPaise(19900)}/meal`, label: "Desk Fuel Veg Tax-Free Base" },
];

const FAQ_ITEMS = [
  {
    question: "How are meal macros and nutritional targets verified?",
    answer: "Every meal is engineered by clinical registered dietitians with weighed ingredient tolerances, complete allergen labeling, and zero industrial oils or hidden sugars.",
  },
  {
    question: "Can I customize my subscription track or pause deliveries?",
    answer: "Yes, you can easily switch between Veg, Egg, and Non-Veg tracks or pause/resume delivery dates up to 9:00 PM the previous evening with zero credit loss.",
  },
  {
    question: "What areas and business parks do you currently serve?",
    answer: "We deliver across major commercial sectors and residences in Noida and select corridors of Greater Noida West with temperature-controlled insulated packaging.",
  },
];

function deriveHeroContent(refCookie?: string) {
  const ref = (refCookie ?? "").toLowerCase();
  if (ref.startsWith("rd_") || ref.startsWith("dietitian_") || ref.includes("diet") || ref.includes("clinic") || ref.startsWith("dr_")) {
    return {
      eyebrow: "Referred by your Registered Dietitian",
      headline: "Clinical meal prescription cooked fresh — verified macro precision at your desk.",
      blurb: `Formulated to align strictly with your dietitian's therapeutic nutritional targets. Zero industrial oils, weighed macro tolerances. Starting from ${formatPaise(19900)} per meal.`,
      badge: "Clinical Adherence Priority",
    };
  }
  if (ref.startsWith("gym_") || ref.startsWith("trainer_") || ref.includes("fit") || ref.includes("gym") || ref.startsWith("coach_")) {
    return {
      eyebrow: "Referred by your Fitness Club & Trainer",
      headline: "Performance macro recovery cooked fresh — delivered straight to your office or gym.",
      blurb: `Engineered for peak hypertrophy and glycemic stability with lab-tested lean proteins and clean complex carbohydrates. Starting from ${formatPaise(19900)} per meal.`,
      badge: "Performance Recovery Protocol",
    };
  }
  return {
    eyebrow: "Now serving Noida",
    headline: "Clinical nutrition, cooked fresh — at your desk in 40–45 minutes.",
    blurb: `RD-designed lunches with verified macros. Real food first, the science on the label. Starting from ${formatPaise(19900)} per meal.`,
    badge: null,
  };
}

/**
 * Consumer Home with DTR Personalization (L-7 / L-2).
 * Inspects tnm_ref attribution cookie to dynamically tailor hero messaging
 * for clinical RD and performance gym referrals.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const refCookie = cookieStore.get("tnm_ref")?.value;
  const hero = deriveHeroContent(refCookie);

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-5xl px-4 py-[var(--space-section)]">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium uppercase tracking-wider text-sage-text">
              {hero.eyebrow}
            </p>
            {hero.badge && (
              <span className="rounded-full bg-[var(--gold)]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-text border border-[var(--gold)]/30">
                {hero.badge}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {hero.headline}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
            {hero.blurb}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="#plans"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] shadow-sm"
            >
              Explore subscription plans
              <span aria-hidden>&rarr;</span>
            </Link>
            <Link
              href="/menu"
              className="inline-flex items-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-line-strong active:scale-95"
            >
              Browse menu &amp; à-la-carte
            </Link>
          </div>

          {/* OB-2's front-door serviceability check. The L-2 homepage replaced
              the hero this used to live in; it belongs here, not lost in the
              merge — advisory only, it never blocks browsing. */}
          <div className="mt-8">
            <ServiceabilityBar placement="hero" />
          </div>
        </div>
      </section>

      <ProofStrip heading="Why Noida professionals trust Tanmatra" items={PROOF_ITEMS} />
      <ConsumerPlansGrid />
      <FaqAccordion pageSlug="/" items={FAQ_ITEMS} />

      <StickyCtaBar
        pageSlug="/"
        title="Tanmatra Nutrition"
        subtitle="RD-designed desk lunches from INR 199/meal."
        ctaLabel="View Plans"
        ctaHref="#plans"
      />
    </div>
  );
}
