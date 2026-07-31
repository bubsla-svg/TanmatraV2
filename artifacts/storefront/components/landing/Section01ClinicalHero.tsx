"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { emitLpEvent } from "@/lib/lpEvents";
import type { HeroContent } from "@/lib/heroContent";

// deriveHeroContent used to live here. app/page.tsx is a Server Component and
// calls it, which a "use client" module cannot serve — it 500'd the homepage in
// a production build. It now lives in @/lib/heroContent; do not move it back.

/**
 * §1: Clinical Hero — Stitch Route Brief 01 (docs/stitch/route-01-home/).
 *
 * Wiring contract (Phase 3): a pure consumer of the server-derived HeroContent
 * — eyebrow/headline/blurb/badge all BIND. (The previous version hardcoded its
 * headline, silently dropping the tnm_ref DTR personalization; that regression
 * ends here.) The per-meal price reaches us pre-formatted inside hero.blurb —
 * no price math, no PLAN_PRICE_TABLE import, server owns every amount.
 *
 * Stitch geometry: asymmetric split (copy 7/12, photo 5/12), one inline plate
 * photo embedded at type-height in the headline, gold pill as the single
 * primary CTA → /menu; every other action on the screen — /plans and the
 * in-photo "Order" — is a ghost pill. The 60s assessment entry survives
 * as a quiet text action firing the SAME analytics label + CustomEvent as
 * before — the on-page stepper (§09) remains its main door.
 */

/** Split the headline for the inline plate photo: at the em-dash pause when the
 *  copy has one, else after the third word. Pure and deterministic (SSR-safe —
 *  server HTML and hydration must agree). */
function splitHeadline(headline: string): [string, string] {
  const dash = headline.indexOf(" — ");
  if (dash > 0) return [headline.slice(0, dash), headline.slice(dash + 1)];
  const words = headline.split(" ");
  if (words.length < 4) return [headline, ""];
  return [words.slice(0, 3).join(" "), words.slice(3).join(" ")];
}

export function Section01ClinicalHero({ hero }: { hero: HeroContent }) {
  const [headStart, headEnd] = splitHeadline(hero.headline);

  const handleAssessmentClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Take Metabolic Assessment" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open_tanmatra_assessment"));
    }
  };

  return (
    <section className="mx-auto w-full max-w-screen-xl px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-14">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Copy column — 7/12, left-weighted (no centered hero) */}
        <div className="lg:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {hero.eyebrow}
          </p>

          <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {headStart}{" "}
            <img
              src="/images/landing/stitch-plate-inline.png"
              alt=""
              aria-hidden
              className="inline-block h-[1.05em] w-[1.6em] rounded-2xl border border-line object-cover align-[-0.12em]"
            />{" "}
            {headEnd}
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            {hero.blurb}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3.5 sm:mt-9">
            <Button asChild shape="pill" size="fluid" className="px-7 py-3.5 font-bold">
              <Link
                href="/menu"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "Explore Today's Menu" })}
              >
                Explore today&rsquo;s menu
              </Link>
            </Button>
            <Button asChild variant="outline" shape="pill" size="fluid" className="border-line-strong px-6 py-3.5 font-semibold hover:bg-surface">
              <Link
                href="/plans"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "See Plans" })}
              >
                See plans
              </Link>
            </Button>
            <button
              type="button"
              onClick={handleAssessmentClick}
              className="-mx-1 px-1 py-2 text-sm font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              60-second assessment
            </button>
          </div>

          {/* Clinical authority trust bar — real accreditations, quiet set */}
          <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-5 text-xs font-medium text-ink-muted">
            <span>ISO 22000 Certified</span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>FSSAI Verified</span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>Dietitian Supervised</span>
          </div>
        </div>

        {/* Photo column — 5/12, tall frame + floating glass macro badge */}
        <div className="relative lg:col-span-5">
          {hero.badge && (
            <span className="absolute left-4 top-4 z-10 rounded-full border border-gold bg-[var(--glass)] px-3 py-1 text-xs font-bold text-gold-text backdrop-blur-md">
              {hero.badge}
            </span>
          )}
          <div className="overflow-hidden rounded-3xl border border-line bg-surface-raised">
            <div className="relative aspect-[4/5] w-full sm:aspect-[3/4]">
              <img
                src="/images/landing/stitch-hero-tall.png"
                alt="Chef-plated clinical meal, photographed from above"
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-2xl border border-line bg-[var(--glass)] px-4 py-3 backdrop-blur-md">
                <div>
                  <p className="text-sm font-bold text-ink">Wild Salmon &amp; Tahini Power Bowl</p>
                  <p className="mt-0.5 font-mono text-[11px] tracking-tight text-ink-muted">
                    480 kcal · 38P · Anti-Inflammatory
                  </p>
                </div>
                {/* Ghost pill, NOT a second gold one. This and the headline CTA
                    above are both default-variant pills to the same href, the
                    same shape and the same colour, ~500px apart and both in view
                    on desktop — and DESIGN.md §01 specifies exactly ONE primary
                    pill per screen, everything else a hairline ghost. Demoted
                    rather than deep-linked to the pictured bowl: this card is
                    decorative art (stitch-hero-tall.png) with no catalogue dish
                    behind it, so a /menu?dish=… href would be a guess that 404s
                    the day the slug moves. */}
                <Button asChild variant="outline" shape="pill" size="fluid" className="shrink-0 border-line-strong bg-transparent px-3.5 py-1.5 text-xs font-bold">
                  <Link href="/menu">Order</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
