"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { GsapScrollImage } from "./GsapScrollImage";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { emitLpEvent } from "@/lib/lpEvents";
import type { HeroContent } from "@/lib/heroContent";
import type { HeroCampaign } from "@/lib/heroCampaign";
import { KitchenSafetyChip } from "@/components/trust/KitchenSafetySheet";

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
    <span className="flex items-center gap-x-3 text-[10px] font-bold uppercase tracking-[.14em] text-ink-muted">
      <span aria-hidden className="text-accent">·</span>
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
    <section className="relative w-full overflow-hidden">
      {/* Full-bleed background: the real shop front in Sector 104, Noida —
          owner-supplied, owner-requested as the hero backdrop (2026-08-29).
          Decorative here (aria-hidden, empty alt): the address it evidences is
          carried in visible text by the footer and the About page. Two scrim
          layers keep the dark ink readable over a busy photograph: a flat wash
          of the page background token, then a vertical gradient that fades the
          section into the plain page at its top and bottom edges — both from
          `--bg`, so the treatment survives a theme change untouched. */}
      <div aria-hidden className="absolute inset-0">
        <SafeImage src="/brand/storefront.jpg" alt="" className="h-full w-full" priority />
        <div className="absolute inset-0 bg-bg/65" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/40 to-bg" />
      </div>
      <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-20 lg:py-24">
        <div className="animate-rise-in">
          {/* Left-aligned reference hero (PR-11c). */}
          {/* Decorative only, and hidden from AT on the wrapper rather than on
              SafeImage: SafeImage's props are {src, alt, className, imgClassName,
              priority} and it spreads nothing, so an `aria-hidden` handed to the
              component itself is silently dropped on the floor. */}
          {/* Announcement / offer strip. Sits above the headline because that is
              where a "this week only" has to be seen before the reader commits to
              reading anything else. Absent when no campaign is running — the slot
              is empty by default rather than filled with a sample offer. */}
          {campaign && (
            <div className="mb-6 flex w-full max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-2.5 text-sm">
              <span className="font-semibold text-ink">{campaign.message}</span>
              {campaign.cta && (
                <Link
                  href={campaign.cta.href}
                  onClick={() => emitLpEvent("hero_campaign_click", { page: "/", label: campaign.id })}
                  /* `touch-target-min` (globals.css) is load-bearing, not
                     decoration: a bare `text-sm` link is ~20px tall, under the
                     WCAG 2.2 SC 2.5.8 24px floor, and the frontend-audit gate
                     measures the live DOM and blocks on it. Same fix the "View
                     menu" link on the homepage carries. */
                  className="touch-target-min font-bold text-gold-text underline underline-offset-4 hover:opacity-80"
                >
                  {campaign.cta.label}
                </Link>
              )}
            </div>
          )}
          {/* The eyebrow rule with no eyebrow text: the reference pairs it with
              a kicker line, and no existing string fills that slot, so the rule
              alone introduces the plate chip. */}
          <div aria-hidden className="mb-7 flex items-center gap-4">
            <span className="h-px w-8 bg-accent" />
            <SafeImage
              src="/brand/hero-plate.jpg"
              alt=""
              className="h-14 w-24 rounded-2xl border border-line sm:h-16 sm:w-28"
            />
          </div>
          <h1 className="max-w-2xl font-display text-[clamp(2.6rem,9vw,4.5rem)] font-semibold leading-[.93] tracking-[-.04em] text-primary">
            {hero.headline}
          </h1>

          <p className="mt-8 max-w-md text-base leading-7 text-ink-muted sm:text-lg animate-rise-in stagger-1">
            {hero.blurb}
          </p>

          {/* One primary action, one escape. This row had three — menu, plans,
              and a "60-second assessment" that opened a five-step quiz — so the
              first thing the page asked a hungry visitor to do was choose how
              to choose. Today's food is the thing worth clicking; the trial and
              the plans get their own sections further down, where someone who
              has seen the food is ready for them. */}
          <div className="mt-9 flex flex-wrap items-center gap-3 animate-rise-in stagger-2">
            <Button asChild shape="pill" size="fluid" className="min-h-12 px-6 text-sm font-bold transition-transform duration-300 hover:scale-105 active:scale-95">
              <Link
                href="/menu"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "See today's menu" })}
              >
                See today&apos;s menu
              </Link>
            </Button>
            <Button asChild variant="outline" shape="pill" size="fluid" className="min-h-12 border-primary/20 bg-transparent px-6 text-sm font-bold text-primary transition-colors hover:bg-surface">
              <Link
                href="/trial"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "Try 3 lunches" })}
              >
                Try three lunches
              </Link>
            </Button>
          </div>

          {/* No star rating here. This row opened with a five-star row and
              "4.9/5" typed as a literal — no review count, no source, no
              endpoint behind it. A rating is the single easiest claim on the
              page for a visitor to test against Google, and it sat next to the
              three certifications that ARE real, borrowing their credibility.
              Bring it back when reviews are a number we can read. */}
          {/* T-20: the credentials are TAPPABLE now — one chip in the first
              viewport opens the Kitchen & safety sheet (registration number,
              ISO 22000 kitchen, cooked-to-order, allergen policy). The three
              claims below stay as the one-line read. */}
          <div className="mt-7 flex animate-rise-in stagger-3">
            <KitchenSafetyChip />
          </div>
          {/* The reference's stats row, carrying the three real claims as its
              labels — no figures, because none exist to put above them. */}
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-primary/15 pt-5 animate-rise-in stagger-4">
            <TrustItem>Cooked after you order</TrustItem>
            <TrustItem>FSSAI-registered kitchen</TrustItem>
            <TrustItem>ISO 22000 kitchen</TrustItem>
          </div>
        </div>

        {/* Photo column — beside the copy from lg, below it before. */}
        <GsapScrollImage className="relative mx-auto w-full max-w-[560px] animate-rise-in stagger-2 lg:mt-4">
          {hero.badge && (
            <span className="absolute left-4 top-4 z-10 rounded-full border border-primary/30 bg-glass px-3 py-1 text-xs font-bold text-gold-text backdrop-blur-md">
              {hero.badge}
            </span>
          )}
          <div className="overflow-hidden rounded-[2rem] border border-primary/10 bg-surface-raised shadow-[var(--shadow-raised)]">
            <div className="relative aspect-[4/3] w-full lg:aspect-square">
              {/* Food back in the frame: with the shop front now wrapping the
                  whole section as its background, repeating the same photo
                  here would show the building twice and the food never — so
                  the framed card returns to the plated-lunch shot it carried
                  before the storefront photo arrived. */}
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
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-glass p-4 backdrop-blur-md shadow-[var(--shadow-card)]">
                <p className="font-display text-lg font-semibold leading-tight text-primary">Today&apos;s menu is up.</p>
                {/* min-h-11 (T-22): this chip measured 50×38. */}
                <Button asChild variant="outline" shape="pill" size="fluid" className="min-h-11 shrink-0 border-primary/20 bg-transparent px-4 text-xs font-bold text-primary hover:bg-surface">
                  <Link href="/menu">Order</Link>
                </Button>
              </div>
            </div>
          </div>
        </GsapScrollImage>
      </div>
    </section>
  );
}
