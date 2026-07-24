import type { Metadata } from "next";
import Link from "next/link";
import { fetchMenu, toProxiedImage } from "@/lib/catalog";
import { PlanCard } from "@/components/plans/PlanCard";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { MetabolicExplorer, type MetabolicDish } from "@/components/metabolic/MetabolicExplorer";
import { SITE_URL } from "@/lib/siteUrl";
import {
  METABOLIC_META,
  METABOLIC_HERO as H,
  PAIN_CARDS,
  METABOLIC_FAQ,
  METABOLIC_PLAN_IDS,
} from "@/content/landing/metabolic";

export const metadata: Metadata = {
  title: METABOLIC_META.title,
  description: METABOLIC_META.description,
  alternates: { canonical: "/metabolic" },
};

export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: METABOLIC_META.title,
  description: METABOLIC_META.description,
  url: `${SITE_URL}/metabolic`,
};

/** `/metabolic` — fat-loss / muscle-gain acquisition lander (route-parity Wave
 *  B). The goal toggle re-filters the live catalog; the program cards are the
 *  storefront's authoritative PLAN_CATALOG plans (server-quoted), not the
 *  legacy per-week RD_PLANS. */
export default async function MetabolicPage() {
  const { dishes } = await fetchMenu();
  const slim: MetabolicDish[] = dishes.map((d) => ({
    slug: d.slug,
    name: d.name,
    image: toProxiedImage(d.image),
    isVeg: d.isVeg,
    gi: d.glycaemicIndex,
    protein: d.macros.protein,
    fiber: d.macros.fiber,
    calories: d.macros.calories,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{H.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {H.title} <span className="text-gold-text">{H.accent}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{H.subtitle}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/plans" className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)]">
            Find your plan <LandingIcon name="arrow-right" className="h-4 w-4" />
          </Link>
          <Link href="/trial" className="inline-flex items-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-line-strong">
            Start a 3-day trial
          </Link>
        </div>
        <div className="mt-8">
          <MetabolicExplorer dishes={slim} />
        </div>
      </header>

      <BenefitGrid eyebrow="The 1 PM problem" heading="You already know how this goes" benefits={PAIN_CARDS} />

      <section className="py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">RD-reviewed programs</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Pick your program</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Every program is designed and signed off by a registered dietitian, with published macros on
          every dish. Prices are per-meal and shown before you commit.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {METABOLIC_PLAN_IDS.map((id) => (
            <PlanCard key={id} id={id} />
          ))}
        </div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Questions</h2>
        <FaqAccordion items={METABOLIC_FAQ} />
      </section>

      <section className="mb-12 rounded-2xl border border-line bg-surface p-6 text-center">
        <h2 className="text-lg font-semibold text-ink">Try three days first.</h2>
        <p className="mt-1 text-sm text-ink-muted">Three RD-reviewed lunches, full creditback if you continue.</p>
        <Link href="/trial" className="mt-4 inline-block rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)]">
          Start your 3-day trial &rarr;
        </Link>
      </section>
    </div>
  );
}
