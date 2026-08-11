import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchMenu, findDish } from "@/lib/catalog";
import { SafeImage } from "@/components/ui/SafeImage";
import { AccordionItem } from "@/components/primitives/Accordion";
import { formatPaise } from "@/lib/format";
import { PdpBuyLedger } from "@/components/menu/PdpBuyLedger";
import { FallbackMenuBanner } from "@/components/menu/FallbackMenuBanner";
import { DishAllergens } from "@/components/menu/DishAllergens";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) return { title: "Not Found | Tanmatra" };
  return { title: `${dish.name} | Tanmatra` };
}

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const { dishes, source } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) notFound();

  const est = dish.macrosEstimated ? "~" : "";

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.5" data-screen-state="default" className="min-h-dvh flex flex-col bg-surface-canvas pb-24">
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
          className="absolute left-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface-canvas/80 text-lg text-ink-primary backdrop-blur-md transition-transform active:scale-[0.98]"
        >
          <span aria-hidden>←</span>
        </Link>
      </div>

      <div className="px-gutter pt-6 flex-1 flex flex-col">
        {source === "fallback" && <FallbackMenuBanner />}
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex gap-2 items-center mb-3">
            <span className="px-2 py-1 rounded-full bg-surface-raised border border-line font-label-caps text-[10px] text-ink-secondary uppercase tracking-widest">
              {dish.isVeg ? "Veg" : "Non-Veg"}
            </span>
            <span className="px-2 py-1 rounded-full bg-surface-raised border border-line font-label-caps text-[10px] text-ink-secondary uppercase tracking-widest">
              {dish.category}
            </span>
            {dish.rdVerified && (
              <span className="px-2 py-1 rounded-full bg-sage-soft/90 border border-sage-strong/20 font-label-caps text-[10px] text-sage-text uppercase tracking-widest">
                RD Verified
              </span>
            )}
          </div>
          
          <h1 className="font-headline-md text-3xl text-ink-primary mb-2">{dish.name}</h1>
          <p className="text-ink-secondary text-sm leading-relaxed mb-4">{dish.longDescription || dish.description}</p>
          
          <div className="flex items-center gap-4 py-4 border-y border-line">
            <div className="flex-1">
              <span className="block font-label-caps text-[10px] text-ink-muted uppercase tracking-widest mb-1">Calories</span>
              <span className="font-mono text-ink-primary">{est}{dish.macros.calories} kcal</span>
            </div>
            <div className="w-px h-8 bg-line"></div>
            <div className="flex-1">
              <span className="block font-label-caps text-[10px] text-ink-muted uppercase tracking-widest mb-1">Protein</span>
              <span className="font-mono text-ink-primary">{est}{dish.macros.protein}g</span>
            </div>
            <div className="w-px h-8 bg-line"></div>
            <div className="flex-1">
              <span className="block font-label-caps text-[10px] text-ink-muted uppercase tracking-widest mb-1">Carbs</span>
              <span className="font-mono text-ink-primary">{est}{dish.macros.carbs}g</span>
            </div>
          </div>
        </div>

        {/* Nutrition & Ingredients Disclosure */}
        <div className="mb-8 flex-1">
          <AccordionItem title="Nutrition details" subtitle="Full macronutrient breakdown">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Fat</span>
                <span>{est}{dish.macros.fat}g</span>
              </div>
              <div className="flex justify-between">
                <span>Fiber</span>
                <span>{est}{dish.macros.fiber}g</span>
              </div>
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
            PDP → Cart Drawer → /checkout path), not just a link past it. */}
        <div className="sticky bottom-4 w-full bg-surface-canvas/95 backdrop-blur-md p-4 rounded-3xl border border-line shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-ink-muted uppercase tracking-widest">Price</span>
              <span className="font-clinical-data text-xl text-gold-text">{formatPaise(dish.price)}</span>
            </div>
            <PdpBuyLedger dish={dish} />
          </div>
        </div>
      </div>
    </div>
  );
}
