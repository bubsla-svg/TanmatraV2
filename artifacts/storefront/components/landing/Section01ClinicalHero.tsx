"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { GsapScrollImage } from "./GsapScrollImage";
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

export function Section01ClinicalHero({ hero }: { hero: HeroContent }) {
  const handleAssessmentClick = () => {
    emitLpEvent("hero_cta_click", { page: "/", label: "Take Metabolic Assessment" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open_tanmatra_assessment"));
    }
  };

  return (
    <section 
      data-ui-generation="stitch-74" 
      data-screen-id="MOB-10-Home-Dark"
      className="mx-auto w-full max-w-screen-xl px-4 py-section-py sm:px-6"
    >
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        {/* Centered Hero Architecture */}
        {/* Decorative only, and hidden from AT on the wrapper rather than on
            SafeImage: SafeImage's props are {src, alt, className, imgClassName,
            priority} and it spreads nothing, so an `aria-hidden` handed to the
            component itself is silently dropped on the floor. */}
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

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5 sm:mt-9">
            <Button asChild shape="pill" size="fluid" className="px-8 py-3.5 font-bold shadow-lg shadow-gold/20 transition-transform duration-300 hover:scale-105 hover:shadow-gold/40 active:scale-95">
              <Link
                href="/menu"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "Explore Today's Menu" })}
              >
                Explore menu
              </Link>
            </Button>
            <Button asChild variant="outline" shape="pill" size="fluid" className="border-line-strong px-7 py-3.5 font-semibold transition-transform duration-300 hover:bg-surface hover:scale-105 active:scale-95">
              <Link
                href="/plans"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "Find a Therapeutic Plan" })}
              >
                View plans
              </Link>
            </Button>
            <button
              type="button"
              onClick={handleAssessmentClick}
              className="-mx-1 px-2 py-2 text-sm font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              60-second assessment
            </button>
          </div>

          {/* Clinical authority trust bar */}
          <div className="mt-9 flex flex-wrap justify-center items-center gap-x-3 gap-y-1.5 border-t border-line pt-5 text-xs font-medium text-ink-muted">
            <span className="flex items-center gap-1 text-gold-text">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                </svg>
              ))}
              <span className="ml-1 text-ink">4.9/5</span>
            </span>
            <TrustItem>ISO 22000 Certified</TrustItem>
            <TrustItem>FSSAI Verified</TrustItem>
            <TrustItem>Dietitian Supervised</TrustItem>
          </div>
        </div>

        {/* Photo area — centered below text */}
        <GsapScrollImage className="relative mt-12 w-full max-w-2xl mx-auto">
          {hero.badge && (
            <span className="absolute left-4 top-4 z-10 rounded-full border border-gold bg-[var(--glass)] px-3 py-1 text-xs font-bold text-gold-text backdrop-blur-md">
              {hero.badge}
            </span>
          )}
          <div className="overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-2xl shadow-black/40">
            <div className="relative aspect-[16/9] w-full">
              <SafeImage
                src="/brand/hero-dish.jpg"
                alt="Chef-plated clinical meal, photographed from above"
                className="h-full w-full"
                imgClassName="transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl border border-line bg-[var(--glass)] p-4 backdrop-blur-md shadow-xl max-w-sm mx-auto">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-0.5">MACRO PROFILE</div>
                  <p className="font-mono text-sm font-bold text-ink tracking-tight">32P · 41C · 12F</p>
                  <div className="mt-2 h-1 w-28 bg-surface-raised rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[70%]" />
                  </div>
                </div>
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
