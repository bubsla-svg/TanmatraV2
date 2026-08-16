import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { fetchMenu, findDish } from "@/lib/catalog";
import { DishImage } from "@/components/menu/DishImage";
import { formatGrams, formatKcal, formatPaise } from "@/lib/format";
import { ingredientSummary } from "@/lib/dishText";
import { PdpBuyLedger } from "@/components/menu/PdpBuyLedger";
import { FallbackMenuBanner } from "@/components/menu/FallbackMenuBanner";
import { DishAllergens } from "@/components/menu/DishAllergens";
import { DishPlanToggle } from "@/components/menu/DishPlanToggle";
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
function Macro({ label, value }: { label: string; value: string }) {
  return (
    <VStack gap={0}>
      <Text type="body" weight="bold" hasTabularNumbers>
        {value}
      </Text>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
    </VStack>
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
            <HStack gap={2}>
              <Badge variant={dish.isVeg ? "green" : "orange"} label={dish.isVeg ? "Veg" : "Non-veg"} />
              <Badge label={dish.category} />
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
            </HStack>

            <Text type="display-2" as="h1">
              {dish.name}
            </Text>

            <Text type="large" weight="bold" hasTabularNumbers>
              {formatPaise(dish.price)}
            </Text>
          </VStack>

          {/* Ingredient NAMES only — the quantities live in the Ingredients
              section below, so this is no longer the same list printed twice
              (see lib/dishText.ts). */}
          <Text type="large" weight="normal" color="secondary">
            {ingredientSummary(dish.ingredients)}
          </Text>

          <Divider />

          <HStack gap={6}>
            <Macro label="Calories" value={formatKcal(dish.macros.calories, dish.macrosEstimated)} />
            <Macro label="Protein" value={formatGrams(dish.macros.protein, dish.macrosEstimated)} />
            <Macro label="Carbs" value={formatGrams(dish.macros.carbs, dish.macrosEstimated)} />
          </HStack>

          {/* `density` is not decoration: without it the group resolves to
              `paddingBlock: 0` and each trigger's box is the capsize-trimmed
              text alone — 380×17, under the 24px WCAG 2.2 SC 2.5.8 floor on
              the two controls this page is built around. `balanced` is the
              library's own answer (spacing-2 either side → 33px); overriding
              the button's padding from outside would fight the component. */}
          <CollapsibleGroup type="multiple" defaultValue={["nutrition"]} density="balanced">
            <Divider />
            <Collapsible value="nutrition" trigger={<Heading level={3}>Nutrition</Heading>}>
              <VStack gap={2}>
                {/* Genuinely every macro — this section used to be labelled
                    "Full macronutrient breakdown" while listing only the two
                    the summary row above omits. */}
                <NutritionRow label="Energy" value={formatKcal(dish.macros.calories, dish.macrosEstimated)} />
                <NutritionRow label="Protein" value={formatGrams(dish.macros.protein, dish.macrosEstimated)} />
                <NutritionRow label="Carbohydrate" value={formatGrams(dish.macros.carbs, dish.macrosEstimated)} />
                <NutritionRow label="Total fat" value={formatGrams(dish.macros.fat, dish.macrosEstimated)} />
                <NutritionRow label="Fibre" value={formatGrams(dish.macros.fiber, dish.macrosEstimated)} />
                {dish.sugarPerServing && <NutritionRow label="Sugar" value={dish.sugarPerServing} />}
              </VStack>
            </Collapsible>

            <Divider />
            <Collapsible
              value="ingredients"
              defaultIsOpen={false}
              trigger={<Heading level={3}>Ingredients</Heading>}
            >
              <VStack gap={1}>
                {dish.ingredients.length === 0 ? (
                  <Text type="body" color="secondary">
                    No ingredients listed.
                  </Text>
                ) : (
                  dish.ingredients.map((entry) => (
                    <Text key={entry} type="body" color="secondary">
                      {entry}
                    </Text>
                  ))
                )}
              </VStack>
            </Collapsible>
            <Divider />
          </CollapsibleGroup>

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
          <div className="relative z-10 w-full rounded-card border border-line bg-bg p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <VStack gap={0}>
                <Text type="supporting" color="secondary">
                  Price
                </Text>
                <Text type="large" weight="bold" hasTabularNumbers className="text-gold-text">
                  {formatPaise(dish.price)}
                </Text>
              </VStack>
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
      <Text type="body" color="secondary">
        {label}
      </Text>
      <Text type="body" hasTabularNumbers>
        {value}
      </Text>
    </div>
  );
}
