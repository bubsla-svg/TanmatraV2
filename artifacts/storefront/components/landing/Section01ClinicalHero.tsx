"use client"; // Interactive hero CTA clicks and assessment trigger event emission

import React from "react";
import { SafeImage } from "@/components/ui/SafeImage";
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
    <section 
      data-ui-generation="stitch-74" 
      data-screen-id="MOB-10-Home-Dark"
      className="mx-auto w-full max-w-screen-xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-20"
    >
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        {/* Centered Hero Architecture */}
        <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {headStart}{" "}
          <span className="inline-block align-middle mx-1.5 w-12 h-10 sm:w-16 sm:h-12 rounded-2xl overflow-hidden border border-line translate-y-[-2px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <SafeImage
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTXgMAoQYxN5p3zcei43W83rQfIoGOdQIO50IXWQyIhBz5qZE3bZ49KT7w1hQmkMVfz9MXWxiPKiegmpAqtWbxDBHxl0ef-8j-NGzOrqsz4XffWPew40F1JHL4h-OejaOjZc6ghvxRhoaseR4F8xrQprNkxz7yPyq8l7BxubvT41I0uW_7RUl4wYQ-c8EyjkcbmTS-iCXT8JY93CjsazBM-FnaNe91ByEkXEjDeN4gSRIq1LBRkNvzifaunvZYeSiBgpjFbIKtA1I"
              alt=""
              aria-hidden
              className="w-full h-full object-cover"
            />
          </span>{" "}
          {headEnd}
        </h1>

          <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-lg">
            {hero.blurb}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5 sm:mt-9">
            <Button asChild shape="pill" size="fluid" className="px-8 py-3.5 font-bold shadow-lg shadow-gold/10">
              <Link
                href="/menu"
                onClick={() => emitLpEvent("hero_cta_click", { page: "/", label: "Explore Today's Menu" })}
              >
                Explore menu
              </Link>
            </Button>
            <Button asChild variant="outline" shape="pill" size="fluid" className="border-line-strong px-7 py-3.5 font-semibold hover:bg-surface">
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
            <span>ISO 22000 Certified</span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>FSSAI Verified</span>
            <span aria-hidden className="text-line-strong">·</span>
            <span>Dietitian Supervised</span>
          </div>
        </div>

        {/* Photo area — centered below text */}
        <div className="relative mt-12 w-full max-w-2xl mx-auto">
          {hero.badge && (
            <span className="absolute left-4 top-4 z-10 rounded-full border border-gold bg-[var(--glass)] px-3 py-1 text-xs font-bold text-gold-text backdrop-blur-md">
              {hero.badge}
            </span>
          )}
          <div className="overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-2xl shadow-black/40">
            <div className="relative aspect-[16/9] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <SafeImage
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkXUatAbp7GpnFbDf0BTpJCPRd2FRuRIoRlbyoRY_B4NGgShl6G32eTYQQ1uxUSny6sOye9Rpm3Xe7cKS4wizt7QZgR72SoEfWc7C02yvSId2aujwgQ8RFWMZVmOfN4ckkE81T7Rkli2yA5Z-tVzDrRcgOmFT5r8klXpPd2k8EuassiZLq5821La5aJB_rvWSK_UQUdLuk5qZwIYRIVhJ85beF2yu9DY9gqtx9XAGuHIN_-stMpiWveI18_bU9E1qUpqZ9a_hlIrE"
                alt="Chef-plated clinical meal, photographed from above"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
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
        </div>
    </section>
  );
}
