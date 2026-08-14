"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { GsapScrollImage } from "./GsapScrollImage";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { emitLpEvent } from "@/lib/lpEvents";
import type { HeroContent } from "@/lib/heroContent";
import type { HeroCampaign } from "@/lib/heroCampaign";

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
 * Stitch geometry: asymmetric split (copy 7/12, photo 5/12), a plate photo as
 * a decorative chip ABOVE the headline, gold pill as the single primary CTA →
 * /menu; every other action on the screen — /plans and the in-photo "Order" —
 * is a ghost pill. The 60s assessment entry survives as a quiet text action
 * firing the SAME analytics label + CustomEvent as before — the on-page
 * stepper (§09) remains its main door.
 *
 * The chip used to be an inline photo embedded at type-height BETWEEN two
 * halves of the headline, which required splitting `hero.headline` on its
 * em-dash. That is gone, and deliberately: a replaced element inside the <h1>
 * put the page's one top-level heading at the mercy of an image load, so a
 * failed asset (or a slow one) fractured the headline mid-sentence, and the
 * split made the accessible name depend on where the copy happened to place a
 * dash. The headline is now one continuous string and the photo is atmosphere
 * beside it.
 */

/**
 * One claim in the clinical trust bar, with its leading interpunct BOUND to it
 * rather than sitting beside it.
 *
 * The separators used to be flex children in their own right — `<span>·</span>`
 * between each pair of labels — which made them independently wrappable. At
 * 390px the bar wraps to three lines, and a naked "·" would settle at the end
 * of a line with nothing after it to separate (and, at some widths, take a
 * line entirely to itself). A separator that lives inside the item it
 * introduces can only ever render immediately before that text.
 */
function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-x-3">
      <span aria-hidden className="text-line-strong">·</span>
      {children}
    </span>
  );
}

// No Stitch markers on this section. It used to carry a screen id from a
// naming scheme that predates the 74-screen manifest ("MOB-10-Home-Dark"),
// declared in no entry of it and with no data-screen-state beside it. The
// home screen's real marker (5.1) is on the route root in
// app/(global)/page.tsx, where the manifest claims it. That orphan was the
// ONLY source id of 49 the manifest did not declare, and the sole reason
// scripts/lint-stitch-markers.ts had to run one-directional; retiring it
// turned the reverse sweep on, so an invented id now fails the build.
export function Section01ClinicalHero({
  hero,
  campaign = null,
}: {
  hero: HeroContent;
  /** Live announcement / offer, resolved server-side. See lib/heroCampaign.ts. */
  campaign?: HeroCampaign | null;
}) {
  return (
    <section className="mx-auto w-full max-w-screen-xl px-4 py-section-py sm:px-6">
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        {/* Centered Hero Architecture */}
        {/* Decorative only, and hidden from AT on the wrapper rather than on
            SafeImage: SafeImage's props are {src, alt, className, imgClassName,
            priority} and it spreads nothing, so an `aria-hidden` handed to the
            component itself is silently dropped on the floor. */}
        {/* Announcement / offer strip. Sits above the headline because that is
            where a "this week only" has to be seen before the reader commits to
            reading anything else. Absent when no campaign is running — the slot
            is empty by default rather than filled with a sample offer. */}
        {campaign && (
          <div className="mb-6 flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm">
            <span className="font-semibold text-ink">{campaign.message}</span>
            {campaign.cta && (
              <Link
                href={campaign.cta.href}
                onClick={() => emitLpEvent("hero_campaign_click", { page: "/", label: campaign.id })}
                className="font-bold text-gold-text underline underline-offset-4 hover:opacity-80"
              >
                {campaign.cta.label}
              </Link>
            )}
          </div>
        )}
        <div aria-hidden className="mb-6">
          <SafeImage
            src="/brand/hero-plate.jpg"
            alt=""
            className="h-14 w-24 rounded-2xl border border-line sm:h-16 sm:w-28"
          />
        </div>
        <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {hero.headline}
        </h1>

          <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-lg">
            {hero.blurb}
          </p>

          {/* One primary action, one escape. This row had three — menu, plans,
              and a "60-second assessment" that opened a five-step quiz — so the
              first thing the page asked a hungry visitor to do was choose how
              to choose. Today's food is the thing worth clicking; the trial and
              the plans get their own sections further down, where someone who
              has seen the food is ready for them. */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5 sm:mt-9">
            <Button asChild shape="pill" size="fluid" className="px-8 py-3.5 font-bold shadow-lg shadow-gold/20 transition-transform duration-300 hover:scale-105 hover:shadow-gold/40 active:scale-95">
              <Link
                href="/menu"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "See today's menu" })}
              >
                See today&apos;s menu
              </Link>
            </Button>
            <Button asChild variant="outline" shape="pill" size="fluid" className="border-line-strong px-7 py-3.5 font-semibold transition-transform duration-300 hover:bg-surface hover:scale-105 active:scale-95">
              <Link
                href="/trial"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "Try 3 lunches" })}
              >
                Try 3 lunches
              </Link>
            </Button>
          </div>

          {/* No star rating here. This row opened with a five-star row and
              "4.9/5" typed as a literal — no review count, no source, no
              endpoint behind it. A rating is the single easiest claim on the
              page for a visitor to test against Google, and it sat next to the
              three certifications that ARE real, borrowing their credibility.
              Bring it back when reviews are a number we can read. */}
          <div className="mt-9 flex flex-wrap justify-center items-center gap-x-3 gap-y-1.5 border-t border-line pt-5 text-xs font-medium text-ink-muted">
            <TrustItem>Cooked after you order</TrustItem>
            <TrustItem>FSSAI licensed kitchen</TrustItem>
            <TrustItem>Checked by our dietitians</TrustItem>
          </div>
        </div>

        {/* Photo area — centered below text */}
        <GsapScrollImage className="relative mt-12 w-full max-w-2xl mx-auto">
          {hero.badge && (
            <span className="absolute left-4 top-4 z-10 rounded-full border border-gold bg-[var(--glass)] px-3 py-1 text-xs font-bold text-gold-text backdrop-blur-md">
              {hero.badge}
            </span>
          )}
          <div className="overflow-hidden rounded-card border border-line bg-surface-raised shadow-2xl shadow-black/40">
            <div className="relative aspect-[16/9] w-full">
              <SafeImage
                src="/brand/hero-dish.jpg"
                alt="A Tanmatra lunch plated from above"
                className="h-full w-full"
                imgClassName="transition-transform duration-700 hover:scale-105"
              />
              {/* The overlay used to be a "MACRO PROFILE" readout — "32P · 41C
                  · 12F" over a progress bar stuck at 70%. Neither belonged to
                  this photograph or to any dish: the numbers were literals and
                  the bar measured nothing. It also spoke in macros to someone
                  who is, at this point, simply deciding whether the food looks
                  good. What earns the space is the invitation. */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--glass)] p-4 backdrop-blur-md shadow-xl max-w-sm mx-auto">
                <p className="text-sm font-semibold text-ink">Today&apos;s menu is up.</p>
                <Button asChild variant="outline" shape="pill" size="fluid" className="shrink-0 border-line-strong bg-transparent px-3.5 py-1.5 text-xs font-bold hover:bg-surface">
                  <Link href="/menu">Order</Link>
                </Button>
              </div>
            </div>
          </div>
        </GsapScrollImage>
    </section>
  );
}
