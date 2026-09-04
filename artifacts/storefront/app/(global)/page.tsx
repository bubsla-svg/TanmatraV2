import { cookies } from "next/headers";
import Link from "next/link";
import { Section01ClinicalHero } from "@/components/landing/Section01ClinicalHero";
import { deriveHeroContent } from "@/lib/heroContent";
import { Section04bMarketplace } from "@/components/landing/Section04bMarketplace";
import { Section04ProtocolsGrid } from "@/components/landing/Section04ProtocolsGrid";
import { PLAN_CATALOG } from "@workspace/subscription-rules";
import { fetchMenu } from "@/lib/catalog";
import { buildSharedMacroKeys } from "@/lib/dishTrust";
import { pickHomeRail } from "@/lib/homeRail";
import { pickPlanCardDishes } from "@/lib/planCardDish";
import { activeCampaign } from "@/lib/heroCampaign";
import { SectionTrialPush } from "@/components/landing/SectionTrialPush";
import { DishCard } from "@/components/DishCard";
import { Section07ProofKitchen } from "@/components/landing/Section07ProofKitchen";
import { Section10FaqAccordion } from "@/components/landing/Section10FaqAccordion";
import { Rail } from "@/components/primitives/Rail";
/**
 * Consumer home. Ordered by the visitor's hunger, not by the revenue model.
 *
 * This file used to open "3-Pillar Revenue Architecture" and stack sixteen
 * sections to match: D2C, B2B enterprise, telehealth, a marketplace, recipes,
 * a fear panel, a logistics moat, an on-page clinical assessment, three
 * separate proof sections and a legal disclaimer to close. It read as an
 * internal deck, and it asked someone who wanted lunch to choose between about
 * twelve destinations before seeing any food.
 *
 * Seven blocks now, in the order a hungry person actually decides:
 *
 *   1. Hero          — what this is, plus the offer slot (see below)
 *   2. Today's menu  — the food, with real photography and one tap to order
 *   3. Trial         — the cheapest possible yes
 *   4. Plans         — the same thing, monthly, for anyone already convinced
 *   5. Pantry        — what else is on the shelf, in stock only
 *   6. Kitchen       — who cooked it and where
 *   7. FAQ           — the objections, answered
 *
 * B2B (/corporate-wellness), telehealth (/rd), recipes and the assessment all
 * keep their own routes; they lost their slot on the entry route, not their
 * existence. The footer and ⌘K still reach every one of them.
 *
 * DYNAMIC ON TWO AXES, and they compose:
 *   - `deriveHeroContent(tnm_ref)` varies the hero by referral cookie, so a
 *     dietitian's patient and a gym's member read different copy.
 *   - `activeCampaign(now)` is the announcement / offer strip marketing drives
 *     — a festival offer, a launch, a delivery waiver. Empty unless one is
 *     live, and it expires by itself. See lib/heroCampaign.ts.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const refCookie = cookieStore.get("tnm_ref")?.value;
  const heroData = deriveHeroContent(refCookie);
  
  const { dishes } = await fetchMenu();
  // F-1: built from the whole catalog, not the 5-item rail — a duplicate pair
  // split across the rail boundary is still a duplicate.
  const sharedMacroKeys = buildSharedMacroKeys(dishes);
  // T-23: the rail led with an alphabetical ₹50 smoothie marked "Macros being
  // verified". It leads with trusted mains now, priced at least the plan's
  // per-meal figure (the spine's number, never typed here) — see lib/homeRail.
  const featuredDishes = pickHomeRail(dishes, sharedMacroKeys, 5, PLAN_CATALOG.desk_fuel.pricePerMealPaise ?? 0);
  // The real dish behind each plan card, off the catalog we just loaded — the
  // grid is a client component and cannot read it itself. Order matters: each
  // plan claims its dish before the next one picks, so no two cards repeat.
  const planDishes = pickPlanCardDishes(["desk_fuel", "steady", "protein_build"], dishes);
  // Resolved once, server-side, so the whole render agrees on "now" — an offer
  // cannot expire between the banner and the section beneath it.
  const campaign = activeCampaign(new Date());

  return (
    <div
      data-ui-generation="stitch-74"
      data-screen-id="5.1"
      data-screen-state="default"
      className="overflow-x-hidden w-full max-w-full relative min-h-dvh pb-20 sm:pb-24"
    >
      {/* A <div>, not a <main>: app/(global)/layout.tsx already opens
          `<main id="main">` around children, and nesting a second one is
          invalid HTML — screen readers announced two main regions on the entry
          route and the skip link landed on the outer one.
          (That sentence used to read "A <main>, not a <main>", because the
          blind div→main replace that put 14 spurious landmarks in this file
          rewrote the very comment warning against them.) */}
      <div className="flex flex-col gap-10 sm:gap-16 lg:gap-20">
        {/* Hero — dynamic on two axes. `heroData` varies the copy by referral
            cookie (dietitian / gym / direct); `campaign` is the announcement +
            offer slot marketing drives, empty unless one is live. */}
        <Section01ClinicalHero hero={heroData} campaign={campaign} />

        {/* The food, immediately. This rail is the page's strongest moment —
            real photography, real prices, one tap to order — so it now sits
            directly under the hero instead of behind a chip rail and two
            pitches. */}
        <section className="mx-auto w-full max-w-[1240px] px-gutter">
          <div className="mb-9 flex items-end justify-between gap-4 animate-rise-in">
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px w-8 bg-accent" />
              <h2 className="font-display text-4xl font-semibold leading-none text-primary sm:text-5xl">On the menu today</h2>
            </div>
            <Link
              href="/menu"
              /* Was 81×16 — exactly the line-height of an uppercase 12px
                 label, under the WCAG 2.2 SC 2.5.8 floor. `touch-target-min`
                 is the house utility (globals.css) and already carries the
                 inline-flex + centring the min-height needs to act on. */
              className="touch-target-min shrink-0 text-sm font-bold text-primary hover:opacity-80"
            >
              View menu
            </Link>
          </div>
          {/* A real list, so a screen reader announces "5 items" before the
              rail instead of reading five unlabelled groups in a row. */}
          <Rail as="ul" bleed="gutter" className="gap-4 pb-4">
            {featuredDishes.map((dish) => (
              <li key={dish.id} className="flex-none w-[280px] snap-start">
                <DishCard dish={dish} compact sharedMacroKeys={sharedMacroKeys} />
              </li>
            ))}
          </Rail>
        </section>

        {/* The cheapest yes on the page, straight after the food. */}
        <SectionTrialPush />

        {/* No ServiceabilityBar here. The Header's is the only instance allowed
            to exist — its verdict/pincode is per-instance state read from
            localStorage once at mount with no `storage` listener, so a second
            copy desynced permanently from sm up: check a pincode in one and
            the other kept saying "Select your location" all session. */}

        <Section04ProtocolsGrid dishes={planDishes} />

        <Section04bMarketplace />

        <Section07ProofKitchen />

        {/* FAQ Accordion */}
        <Section10FaqAccordion />
      </div>
    </div>
  );
}
