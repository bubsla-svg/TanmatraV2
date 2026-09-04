import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findDish, fetchMenu } from "@/lib/catalog";
import { SafeImage } from "@/components/ui/SafeImage";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ dishSlug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.dishSlug, dishes);
  if (!dish) return { title: "Not Found" };
  return { title: `${dish.name} Guide` };
}

export default async function MealGuidePage({ params }: { params: Promise<{ dishSlug: string }> }) {
  const resolvedParams = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(resolvedParams.dishSlug, dishes);
  if (!dish) notFound();

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.11" data-screen-state="default" className="min-h-dvh flex flex-col bg-bg pb-24">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-primary">Meal Guide</h1>
          <p className="text-sm text-ink-muted">Nutrition insights & pairing</p>
        </div>
        <Link href={`/dish/${dish.slug}`} className="px-4 py-2 rounded-full bg-secondary border border-line text-xs font-semibold text-ink hover:bg-secondary/80 transition-colors">
          View Dish
        </Link>
      </div>

      <div className="px-gutter pt-6 flex flex-col gap-8">
        {/* Dish Summary */}
        <div className="flex gap-4 items-center">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-surface flex-shrink-0 border border-line">
            <SafeImage src={dish.image ?? ""} alt={dish.name} className="h-full w-full" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-primary mb-1">{dish.name}</h2>
            <div className="flex gap-2">
              <span className="font-data text-xs font-bold text-primary">{dish.macros?.calories ?? 0} kcal</span>
              <span className="text-ink-muted text-xs">•</span>
              <span className="font-data text-xs font-bold text-primary">{dish.macros?.protein ?? 0}g P</span>
            </div>
          </div>
        </div>

        {/* Clinical Breakdown */}
        <div>
          <h3 className="font-display font-bold text-xl text-primary mb-4">Clinical Breakdown</h3>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h4 className="font-bold text-2xs text-primary uppercase tracking-widest mb-1">Blood Sugar Impact</h4>
              <p className="text-sm text-ink-muted leading-relaxed">
                Formulated with {dish.macros?.fiber ?? 0}g of dietary fiber to blunt insulin spikes. Best consumed during peak metabolic windows (12 PM - 3 PM).
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h4 className="font-bold text-2xs text-primary uppercase tracking-widest mb-1">Satiety Index</h4>
              <p className="text-sm text-ink-muted leading-relaxed">
                High protein density ({dish.macros?.protein ?? 0}g) ensures prolonged satiety without gastric distress.
              </p>
            </div>
          </div>
        </div>

        {/* Pairing Suggestions */}
        <div>
          <h3 className="font-display font-bold text-xl text-primary mb-4">Optimal Pairing</h3>
          <p className="text-sm text-ink-muted leading-relaxed bg-secondary p-4 rounded-2xl border border-line">
            Pair with a hydration source or a light probiotic side to enhance nutrient absorption. Avoid combining with refined carbohydrates.
          </p>
        </div>
      </div>
    </div>
  );
}
