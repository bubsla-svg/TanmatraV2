import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchMenu, findDish } from "@/lib/catalog";
import { SafeImage } from "@/components/ui/SafeImage";
import { AccordionItem } from "@/components/primitives/Accordion";
import { formatPaise } from "@/lib/format";
import { ingredientSummary } from "@/lib/dishText";
import { PdpBuyLedger } from "@/components/menu/PdpBuyLedger";
import { FallbackMenuBanner } from "@/components/menu/FallbackMenuBanner";
import { DishAllergens } from "@/components/menu/DishAllergens";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) return { title: "Not Found" };
  return { title: dish.name };
}

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const { dishes, source } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) notFound();

  const est = dish.macrosEstimated ? "~" : "";

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.5" data-screen-state="default" className="min-h-dvh flex flex-col bg-bg pb-24">
      {/* Hero Image */}
      <div className="relative w-full aspect-square md:aspect-video overflow-hidden">
        <SafeImage src={dish.image} alt={dish.name} className="h-full w-full" />
        {/* The focus shell renders no Header, and FocusLayout's contract is
            that each flow supplies its own back affordance. This page had
            none — arriving here from a protocol rail, a saved favourite or a
            search result left browser Back as the only way out. */}
        <Link
          href="/menu"
          aria-label="Back to menu"
          className="absolute left-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-bg/80 text-lg text-ink backdrop-blur-md transition-transform active:scale-[0.98]"
        >
          <span aria-hidden>←</span>
        </Link>
      </div>

      <div className="px-gutter pt-6 flex-1 flex flex-col">
        {source === "fallback" && <FallbackMenuBanner />}
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex gap-2 items-center mb-3">
            <span className="px-2 py-1 rounded-full bg-surface-raised border border-line font-bold text-3xs text-ink-muted uppercase tracking-widest">
              {dish.isVeg ? "Veg" : "Non-Veg"}
            </span>
            <span className="px-2 py-1 rounded-full bg-surface-raised border border-line font-bold text-3xs text-ink-muted uppercase tracking-widest">
              {dish.category}
            </span>
            {dish.rdVerified && (
              <span className="px-2 py-1 rounded-full bg-sage-soft/90 border border-[var(--sage)]/20 font-bold text-3xs text-sage-text uppercase tracking-widest">
                RD Verified
              </span>
            )}
          </div>
          
          <h1 className="font-bold text-3xl text-ink mb-2">{dish.name}</h1>
          {/* N5.4: NOT `longDescription || description` — both are the
              ingredient list (with quantities and a different separator),
              which the Ingredients accordion below already renders in full.
              Printing it here too was one string shown twice. Names only;
              the accordion keeps the quantities. */}
          <p className="text-ink-muted text-sm leading-relaxed mb-4">
            {ingredientSummary(dish.ingredients)}
          </p>
          
          <div className="flex items-center gap-4 py-4 border-y border-line">
            <div className="flex-1">
              <span className="block font-bold text-3xs text-ink-muted uppercase tracking-widest mb-1">Calories</span>
              <span className="font-mono text-ink">{est}{dish.macros.calories} kcal</span>
            </div>
            <div className="w-px h-8 bg-line"></div>
            <div className="flex-1">
              <span className="block font-bold text-3xs text-ink-muted uppercase tracking-widest mb-1">Protein</span>
              <span className="font-mono text-ink">{est}{dish.macros.protein}g</span>
            </div>
            <div className="w-px h-8 bg-line"></div>
            <div className="flex-1">
              <span className="block font-bold text-3xs text-ink-muted uppercase tracking-widest mb-1">Carbs</span>
              <span className="font-mono text-ink">{est}{dish.macros.carbs}g</span>
            </div>
          </div>
        </div>

        {/* Nutrition & Ingredients Disclosure */}
        <div className="mb-8 flex-1">
          {/* N5.5: this said "Full macronutrient breakdown" while listing only
              Fat and Fiber — i.e. the two macros the summary strip above
              DOESN'T show, which is the opposite of full. Now genuinely all
              five of DishMacros, so the label is true and the panel stands on
              its own instead of being a footnote to the strip. */}
          <AccordionItem title="Nutrition details" subtitle="Full macronutrient breakdown">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Energy</span>
                <span className="tabular">{est}{dish.macros.calories} kcal</span>
              </div>
              <div className="flex justify-between">
                <span>Protein</span>
                <span className="tabular">{est}{dish.macros.protein} g</span>
              </div>
              <div className="flex justify-between">
                <span>Carbohydrate</span>
                <span className="tabular">{est}{dish.macros.carbs} g</span>
              </div>
              <div className="flex justify-between">
                <span>Total fat</span>
                <span className="tabular">{est}{dish.macros.fat} g</span>
              </div>
              <div className="flex justify-between">
                <span>Fibre</span>
                <span className="tabular">{est}{dish.macros.fiber} g</span>
              </div>
              {dish.sugarPerServing && (
                <div className="flex justify-between border-t border-line pt-2">
                  <span>Sugar</span>
                  <span className="tabular">{dish.sugarPerServing}</span>
                </div>
              )}
            </div>
          </AccordionItem>
          
          <AccordionItem title="Ingredients">
            <p>{dish.ingredients.join(", ") || "No ingredients listed."}</p>
          </AccordionItem>

          {/* Never collapsed behind the accordion above: this preserves the
              reviewed / auto-detected / under-review states from
              lib/allergenCopy.ts (an unreviewed or auto-detected list must
              never render as an affirmative "no allergens"), and a customer
              with allergies needs it visible, not opt-in. Mirrors
              DishDrawer.tsx, the drawer surface for this same dish. */}
          <DishAllergens dish={dish} />
        </div>

        {/* Bottom CTA — the StickyAddToCartLedger (UX/UI Architecture Phase 2
            §6). This shell (app/(focus)/) renders no MiniCartBar, so the
            route onward to checkout has to live here: PdpBuyLedger adds AND
            opens the Cart Drawer in one action (the doc's canonical
            PDP → Cart Drawer → /checkout path), not just a link past it.

            N5.6: `sticky bottom-4` floats the card 16px above the viewport
            bottom, and at 95% alpha that 16px band let page content scroll
            visibly THROUGH it under the card — read as a rendering glitch,
            not as a float. The float is kept (it is the design), and the
            band is masked instead: a matching opaque strip sits behind the
            gap via the wrapper's ::after, so the card still reads as
            floating while nothing slides beneath it. Wrapper carries the
            sticky positioning so the mask travels with the card. */}
        <div className="sticky bottom-0 w-full pb-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-4 after:bg-bg after:content-['']">
          <div className="relative z-10 w-full rounded-3xl border border-line bg-bg/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-bold text-3xs text-ink-muted uppercase tracking-widest">Price</span>
                <span className="font-clinical-data text-xl text-gold-text">{formatPaise(dish.price)}</span>
              </div>
              <PdpBuyLedger dish={dish} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
