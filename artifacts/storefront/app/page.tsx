import Link from "next/link";
import { ConsumerPlansGrid } from "@/components/landing/ConsumerPlansGrid";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
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

/**
 * Consumer Home (L-2 rework per §2).
 * Integrates live P-2 plan variants grid, parity strip, and shared conversion primitives.
 */
export default function HomePage() {
  return (
    <div className="pb-24">
      <section className="mx-auto max-w-5xl px-4 py-[var(--space-section)]">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-sage-text">
            Now serving Noida
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            Clinical nutrition, cooked fresh — at your desk in 40&ndash;45 minutes.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
            RD-designed lunches with verified macros. Real food first, the science
            on the label. Starting from {formatPaise(19900)} per meal.
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
