import type { Metadata } from "next";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { fetchMenu } from "@/lib/catalog";
import { SITE_URL } from "@/lib/siteUrl";
import { PlanCardStitch } from "@/components/plans/PlanCardStitch";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { LandingIcon } from "@/components/landing/LandingIcon";
import {
  METABOLIC_FAQ,
  METABOLIC_HERO,
  METABOLIC_META,
  METABOLIC_PLAN_IDS,
  PAIN_CARDS,
} from "@/content/landing/metabolic";
import {
  MetabolicExplorer,
  type MetabolicDish,
} from "@/components/metabolic/MetabolicExplorer";

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

/**
 * `/metabolic` — Stitch 11.1 metabolic-program lander.
 *
 * This route was a "Clean slate placeholder" while BOTH halves of it already
 * existed: the compliance-annotated copy in `content/landing/metabolic.ts`
 * (zero importers) and `MetabolicExplorer`, which was written against exactly
 * that copy and then left in quarantine. The page below is the missing wire,
 * not a new design — the explorer is restored verbatim.
 *
 * Server component: the catalog is fetched here and handed down as a slim
 * projection, so the goal toggle filters LIVE dishes rather than a hardcoded
 * sample, and no pricing is ever authored client-side (the program cards are
 * server-quoted by PlanCardStitch, same as /plans).
 */
export default async function MetabolicPage() {
  const { dishes } = await fetchMenu();

  // Slim projection — only the fields MetabolicExplorer's filter/preview read.
  const preview: MetabolicDish[] = dishes.filter(isAlaCarteEnabled).map((d) => ({
    slug: d.slug,
    name: d.name,
    image: d.image,
    isVeg: d.isVeg,
    gi: d.glycaemicIndex,
    protein: d.macros.protein,
    fiber: d.macros.fiber,
    calories: d.macros.calories,
  }));

  return (
    <div
      data-ui-generation="stitch-74"
      data-screen-id="11.1"
      data-screen-state="default"
      data-testid="metabolic-program-landing"
      className="min-h-dvh"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-screen-xl px-4 py-10">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">
              {METABOLIC_HERO.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary sm:text-4xl">
              {METABOLIC_HERO.title}{" "}
              <span className="text-ink-muted">{METABOLIC_HERO.accent}</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">
              {METABOLIC_HERO.subtitle}
            </p>
          </div>

          {/* The goal toggle + live-catalog preview — the screen's centrepiece. */}
          <MetabolicExplorer dishes={preview} />
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold leading-tight text-primary">
          Why people switch
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_CARDS.map((card) => (
            <div key={card.title} className="rounded-2xl border border-line bg-surface p-5">
              <LandingIcon name={card.icon} className="h-5 w-5 text-accent" />
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight text-primary">{card.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{card.body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold leading-tight text-primary">
          Programs built for these goals
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {METABOLIC_PLAN_IDS.map((id) => (
            <PlanCardStitch key={id} id={id} />
          ))}
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold leading-tight text-primary">
          Before you start
        </h2>
        <div className="mt-4 max-w-3xl">
          <FaqAccordion items={METABOLIC_FAQ} pageSlug="/metabolic" defaultOpen={null} />
        </div>
      </section>
    </div>
  );
}
