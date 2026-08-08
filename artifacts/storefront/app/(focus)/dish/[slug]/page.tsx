import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenu, findDish } from "@/lib/catalog";
import { SafeImage } from "@/components/ui/SafeImage";
import { AccordionItem } from "@/components/primitives/Accordion";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) return { title: "Not Found | Tanmatra" };
  return { title: `${dish.name} | Tanmatra` };
}

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.slug, dishes);
  if (!dish) notFound();

  const est = dish.macrosEstimated ? "~" : "";

  return (
    <div className="min-h-dvh flex flex-col bg-surface-canvas pb-24">
      {/* Hero Image */}
      <div className="relative w-full aspect-square md:aspect-video overflow-hidden">
        <SafeImage src={dish.image} alt={dish.name} className="h-full w-full" />
      </div>

      <div className="px-gutter pt-6 flex-1 flex flex-col">
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
          
          <AccordionItem title="Ingredients & Allergens">
            <div className="space-y-4">
              <div>
                <strong className="block text-ink-primary mb-1">Ingredients</strong>
                <p>{dish.ingredients.join(", ") || "No ingredients listed."}</p>
              </div>
              <div>
                <strong className="block text-ink-primary mb-1">Allergens</strong>
                <p>{dish.allergens.length ? dish.allergens.join(", ") : "None declared."}</p>
              </div>
            </div>
          </AccordionItem>
        </div>

        {/* Bottom CTA (Sticky in FocusLayout context typically handles itself, but we ensure it's here) */}
        <div className="sticky bottom-4 w-full bg-surface-canvas/95 backdrop-blur-md p-4 rounded-3xl border border-line flex items-center justify-between shadow-2xl">
          <div className="flex flex-col">
            <span className="font-label-caps text-[10px] text-ink-muted uppercase tracking-widest">Price</span>
            <span className="font-clinical-data text-xl text-gold-text">{formatPaise(dish.price)}</span>
          </div>
          <AddToCart dish={dish} />
        </div>
      </div>
    </div>
  );
}
