import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchMenu, toProxiedImage } from "@/lib/catalog";
import { getRds } from "@/lib/rdApi";
import { PlanCard } from "@/components/plans/PlanCard";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { CareHero } from "@/components/care/CareHero";
import { CareRdRoster } from "@/components/care/CareRdRoster";
import { CareEvidence, type CareDish } from "@/components/care/CareEvidence";
import { SITE_URL } from "@/lib/siteUrl";
import type { LandingBenefit } from "@/content/landing/partners";
import {
  CARE_CONFIG, CARE_CONDITIONS, isCareCondition, CONSULT_HREF,
  PROTOCOL_STEPS, SCIENCE_LOW_GI, SCIENCE_ALLERGEN, CARE_SAFETY, CARE_CLOSE,
} from "@/content/landing/care";

type Params = { params: Promise<{ condition: string }> };
export const revalidate = 3600;

export function generateStaticParams() {
  return CARE_CONDITIONS.map((condition) => ({ condition }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { condition } = await params;
  if (!isCareCondition(condition)) return { title: "Care Protocols | Tanmatra", robots: { index: false } };
  const cfg = CARE_CONFIG[condition];
  return { title: cfg.metaTitle, description: cfg.metaDescription, alternates: { canonical: `/care/${condition}` } };
}

export default async function CarePage({ params }: Params) {
  const { condition } = await params;
  if (!isCareCondition(condition)) notFound();
  const cfg = CARE_CONFIG[condition];

  const [{ dishes }, rds] = await Promise.all([fetchMenu(), getRds()]);
  const careDishes: CareDish[] = dishes.map((d) => ({
    slug: d.slug, name: d.name, image: toProxiedImage(d.image), gi: d.glycaemicIndex,
    calories: d.macros.calories, carbs: d.macros.carbs, fiber: d.macros.fiber, sugarPerServing: d.sugarPerServing,
  }));
  // A real low-GI plate for the hero — the same population CareEvidence draws
  // from, so the image is never off-protocol for the condition.
  const heroDish = careDishes.find((d) => d.gi === "low");
  const science: LandingBenefit[] = [
    SCIENCE_LOW_GI,
    { icon: "scale", title: "Macro caps, printed", body: cfg.capsBody },
    SCIENCE_ALLERGEN,
  ];
  const jsonLd = {
    "@context": "https://schema.org", "@type": "WebPage",
    name: cfg.metaTitle, description: cfg.metaDescription, url: `${SITE_URL}/care/${condition}`,
  };

  return (
    <div className="mx-auto max-w-5xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CareHero
        cfg={cfg}
        image={heroDish ? { src: heroDish.image, alt: heroDish.name } : undefined}
      />
      <CareRdRoster rds={rds} />
      <BenefitGrid variant="steps" eyebrow="The protocol" heading="How it works" benefits={PROTOCOL_STEPS} />

      <BenefitGrid eyebrow="The science, honestly" heading="Claims we can measure. Nothing we can’t." benefits={science} />
      <p className="-mt-6 text-[11px] leading-relaxed text-ink-faint">
        Macros are lab-informed estimates; when a value is provisional, we label it provisional.
      </p>
      {cfg.marketStat && (
        <div className="mt-4 rounded-3xl border border-line bg-surface-subtle p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{cfg.marketStat.label}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{cfg.marketStat.body}</p>
        </div>
      )}

      <section id="program" className="scroll-mt-20 py-[var(--space-section)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">The program</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">An RD-designed low-GI program</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Your dietitian builds your weekly rotation from this program. Pricing is per-meal and shown before you commit.
        </p>
        <div className="mt-8 max-w-md">
          <PlanCard id={cfg.planId} />
        </div>
      </section>

      <CareEvidence dishes={careDishes} sort={cfg.dishSort} />

      <section className="py-6">
        <div className="rounded-3xl border border-[color-mix(in_srgb,var(--sage)_35%,transparent)] bg-sage-soft p-5">
          <p className="text-sm font-semibold text-ink">{CARE_SAFETY.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{CARE_SAFETY.body}</p>
        </div>
      </section>

      <section className="mb-12 mt-6 rounded-3xl border border-line bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{CARE_CLOSE.headline}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{CARE_CLOSE.body}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={CONSULT_HREF} className="w-full rounded-full bg-gold px-8 py-4 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] sm:w-auto">
            Book the free consult
          </Link>
          <Link href="/trial" className="w-full rounded-full border border-line px-8 py-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong sm:w-auto">
            Try 3 days first
          </Link>
        </div>
      </section>
    </div>
  );
}
