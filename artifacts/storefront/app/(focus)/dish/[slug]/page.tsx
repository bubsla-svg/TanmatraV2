import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Disclosure } from "@/components/primitives/Disclosure";
import { fetchMenu, findDish } from "@/lib/catalog";
import { DishImage } from "@/components/menu/DishImage";
import { formatGrams, formatKcal, formatPaise } from "@/lib/format";
import { ingredientSummary } from "@/lib/dishText";
import { PdpBuyLedger } from "@/components/menu/PdpBuyLedger";
import { FallbackMenuBanner } from "@/components/menu/FallbackMenuBanner";
import { DishAllergens } from "@/components/menu/DishAllergens";
import { DishPlanToggle } from "@/components/menu/DishPlanToggle";
import { PantryRail } from "@/components/menu/PantryRail";
import { ViewDishBeacon } from "@/components/menu/ViewDishBeacon";
import { dishPlanOffer } from "@/lib/dishPlanOffer";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) return { title: "Not Found" };
  return { title: dish.name };
}

/** One macro reading. Astryx type scale, not the uppercase `tracking-widest`
 *  `text-3xs` micro-label + bordered chip the previous version used for every
 *  figure — that treatment is what made a lunch page read as an instrument
 *  panel. Value first, label under it, no box. */
/** PR-11c: the revision's macro cell — display-face value over a small
 *  uppercase label. */
function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-primary">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-ink-muted">{label}</p>
    </div>
  );
}

/**
 * Dish detail page, composed on the Astryx `product-detail` page template
 * (`@astryxdesign/cli/templates/pages/product-detail`) — DS-0's sanctioned
 * starting point, per CLAUDE.md ("Astryx templates and blocks ARE the
 * sanctioned starting point — adopting them verbatim is the goal").
 *
 * WHAT CHANGED AND WHY: the previous hand-rolled version rendered every
 * figure as a bordered chip with an uppercase `tracking-widest text-3xs`
 * label over a mono numeral, on near-black surfaces — the template's own
 * hierarchy (display title → price → generous body copy → collapsible
 * detail) replaced with a uniform grid of instrument readouts. Owner's
 * verdict was that it read as an "ordnance depot disguised as a PDP", and
 * that is a fair description of the treatment, not of the content.
 *
 * Adopted from the template: the `display-2` title, the price/description
 * hierarchy, `CollapsibleGroup` + `Divider` for detail sections (replacing
 * the bespoke AccordionItem), and Astryx's type scale throughout instead of
 * raw Tailwind font sizes.
 *
 * Deliberately NOT adopted: the template's colour/finish/quantity
 * `SegmentedControl`s (a dish has no such variants — customisations are a
 * separate, server-priced concern), its two-column sticky-info desktop grid
 * (this route is the mobile-first focus shell), and its "Buy it now"
 * secondary CTA (this funnel's canonical path is add → cart drawer →
 * checkout; a second money CTA here would fork it).
 *
 * Held from before, unchanged: the price is rendered exactly as the server
 * sent it, gold stays the only action colour (the badges below are signal —
 * sanctioned by DS-0), and DishAllergens is never collapsed behind a
 * disclosure.
 */
export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const { dishes, source } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) notFound();

  // Resolved server-side: the rotation comes off the catalog this page already
  // loaded, and the price is the spine's. Null when no bookable plan carries
  // the dish, which is the common case.
  const planOffer = dishPlanOffer(dish.slug, dishes);


  return (
    // pb-32 (128px), not pb-24: the sticky ledger card measures ~90px plus
    // its 16px mask band, so 96px left the last content row sitting under
    // it. Clearance is the card's real height, not a round number.
    //
    // The data-screen-* attributes are load-bearing, not decoration: the
    // Stitch runtime suite asserts this exact marker to prove screen 5.5 is
    // wired (e2e/specs/stitch-runtime/commerce.spec.ts), and
    // tools/verify-stitch-wiring.mjs reconciles the manifest against them.
    // Dropping them in the Astryx rebuild is what broke that spec.
    <div
      data-ui-generation="stitch-74"
      data-screen-id="5.5"
      data-screen-state="default"
      className="flex min-h-dvh flex-col bg-bg pb-32"
    >
      <ViewDishBeacon dishSlug={dish.slug} hasPlanOption={planOffer !== null} />
      <div className="relative aspect-square w-full overflow-hidden md:aspect-video">
        {/* DishImage, not SafeImage. `SafeImage`'s `fallback` is optional —
            correctly, for a marketplace product or a landing hero — which
            made the branded tile something every dish surface had to
            REMEMBER. DishImage's own doc lists the five that forgot and were
            converted; this hero was the sixth and was missed, so a dish that
            renders its tile on the card and in the drawer degraded to the
            neutral ImageOff glyph the moment you tapped "Open full page".
            Confirmed from a customer screen recording, on the largest image
            on the route. §3.5 permits a real photo or the tile, nothing
            else. */}
        <DishImage src={dish.image} name={dish.name} alt={dish.name} priority className="h-full w-full" />
        {/* The focus shell renders no Header, and FocusLayout's contract is
            that each flow supplies its own back affordance. */}
        <Link
          href="/menu"
          aria-label="Back to menu"
          className="absolute left-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-bg/80 text-lg text-ink backdrop-blur-md transition-transform active:scale-[0.98]"
        >
          <span aria-hidden>←</span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-gutter pt-6">
        {source === "fallback" && <FallbackMenuBanner />}

        <VStack gap={5}>
          <VStack gap={2}>
            {/* PR-11c: the revision's eyebrow row (diet · category) in place
                of two badges — same two strings. */}
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-accent">
              <span>{dish.isVeg ? "Veg" : "Non-veg"}</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
              <span>{dish.category}</span>
              {/* The "RD reviewed" badge that stood here is REMOVED — the
                  last surviving instance of finding F5's unearned claim.
                  `dish.rdVerified` is true on all 145 live dishes including
                  the dead SKUs (POS imports are written in pre-reviewed by
                  lib/petpooja.ts), so the condition was decorative: the badge
                  rendered on every dish, and a claim that cannot be false is
                  not evidence of anything.

                  The same finding already removed the site-wide chip from the
                  Header and kept the claim out of /menu's trust strip. This
                  per-dish green "success" badge outlived both — sitting on
                  the product page, next to the price, at the moment of
                  purchase, which is the worst place for a clinical claim with
                  nothing behind it. It returns when F5 is resolved data-side
                  and a genuine per-dish signal exists to read. */}
            </div>

            <h1 className="font-display text-4xl font-semibold leading-[.94] tracking-[-.04em] text-primary sm:text-6xl">
              {dish.name}
            </h1>

            <p className="font-data text-2xl font-bold text-primary">{formatPaise(dish.price)}</p>
          </VStack>

          {/* Ingredient NAMES only — the quantities live in the Ingredients
              section below, so this is no longer the same list printed twice
              (see lib/dishText.ts). */}
          <p className="max-w-lg text-base leading-7 text-ink-muted">{ingredientSummary(dish.ingredients)}</p>

          {/* The revision's three-up macro strip, ruled top and bottom. */}
          <div className="grid grid-cols-3 gap-4 border-y border-line py-5">
            <Macro label="Calories" value={formatKcal(dish.macros.calories, dish.macrosEstimated, dish.macrosProvisional)} />
            <Macro label="Protein" value={formatGrams(dish.macros.protein, dish.macrosEstimated, dish.macrosProvisional)} />
            <Macro label="Carbs" value={formatGrams(dish.macros.carbs, dish.macrosEstimated, dish.macrosProvisional)} />
          </div>

          {/* PR-11e (brief CUJ 3 §3): the shared Disclosure — one row open at a
              time, Nutrition first; the three-up strip above is the summary row
              that never collapses. Ingredients stay complete when open (never
              clamped), one tap away — the same two labels the quick view uses. */}
          <Disclosure
            defaultOpen={0}
            items={[
              {
                key: "nutrition",
                summary: <span className="font-display text-lg font-semibold leading-tight text-primary">Nutrition</span>,
                body: (
                  <VStack gap={2}>
                    {/* Genuinely every macro — this section used to be labelled
                        "Full macronutrient breakdown" while listing only the two
                        the summary row above omits. */}
                    <NutritionRow label="Energy" value={formatKcal(dish.macros.calories, dish.macrosEstimated, dish.macrosProvisional)} />
                    <NutritionRow label="Protein" value={formatGrams(dish.macros.protein, dish.macrosEstimated, dish.macrosProvisional)} />
                    <NutritionRow label="Carbohydrate" value={formatGrams(dish.macros.carbs, dish.macrosEstimated, dish.macrosProvisional)} />
                    <NutritionRow label="Total fat" value={formatGrams(dish.macros.fat, dish.macrosEstimated, dish.macrosProvisional)} />
                    <NutritionRow label="Fibre" value={formatGrams(dish.macros.fiber, dish.macrosEstimated, dish.macrosProvisional)} />
                    {dish.sugarPerServing && <NutritionRow label="Sugar" value={dish.sugarPerServing} />}
                  </VStack>
                ),
              },
              {
                key: "ingredients",
                summary: <span className="font-display text-lg font-semibold leading-tight text-primary">Ingredients</span>,
                body: (
                  <VStack gap={1}>
                    {dish.ingredients.length === 0 ? (
                      <Text type="body" color="secondary">
                        No ingredients listed.
                      </Text>
                    ) : (
                      dish.ingredients.map((entry) => (
                        <div key={entry} className="flex items-center gap-3 border-b border-line pb-3 text-sm text-ink-muted">
                          <span aria-hidden className="shrink-0 text-accent">✓</span>
                          {entry}
                        </div>
                      ))
                    )}
                  </VStack>
                ),
              },
            ]}
          />

          {/* T-17: pantry rail above the allergen block — cross-sell before
              the decision, not only after Add inside the cart sheet. */}
          <PantryRail />

          {/* Never collapsed (§6): the reviewed / auto-detected / under-review
              states must stay visible — an unreviewed list must never read as
              an affirmative "no allergens". Mirrors DishDrawer.tsx. */}
          <DishAllergens dish={dish} />

          {/* Plan item 1.1. Rendered only when a BOOKABLE plan actually rotates
              this dish — null for 60 of 116, and a toggle offering a plan that
              never serves the dish would be worse than no toggle. It does not
              add a second money CTA: the sticky ledger below stays the
              one-time buy, per this file's own note on the template's dropped
              "Buy it now". */}
          {planOffer && (
            <DishPlanToggle offer={planOffer} dishSlug={dish.slug} dishPricePaise={dish.price} />
          )}
        </VStack>

        {/* N5.6: the float is the design; the 16px band beneath it is masked
            so page content can't scroll visibly through the gap. */}
        <div className="sticky bottom-0 mt-8 w-full pb-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-4 after:bg-bg after:content-['']">
          {/* OPAQUE, not bg-bg/95: at 95% the page's own text stayed legible
              straight through the card as it scrolled past — which is what
              N5.6 actually reported. The mask band below handles the 16px
              float gap; this handles the card itself. */}
          <div className="relative z-10 w-full rounded-card border border-line bg-bg p-4 shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-ink-muted">Price</p>
                <p className="font-data text-2xl font-bold text-primary">{formatPaise(dish.price)}</p>
              </div>
              <PdpBuyLedger dish={dish} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One row of the nutrition panel. */
function NutritionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-data text-sm font-bold text-primary">{value}</span>
    </div>
  );
}
