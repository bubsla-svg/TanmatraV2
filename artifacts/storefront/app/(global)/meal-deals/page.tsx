import type { Metadata } from "next";
import { fetchMenu } from "@/lib/catalog";
import { buildBundles } from "@/lib/mealBundles";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatPaise } from "@/lib/format";

export const metadata: Metadata = {
  title: "Meal Deals | Tanmatra",
};

export default async function MealDealsPage() {
  const { dishes } = await fetchMenu();
  const bundles = buildBundles(dishes);

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.9" data-screen-state="default" className="min-h-dvh flex flex-col bg-surface-canvas pb-24">
      <div className="sticky top-0 z-20 bg-surface-canvas/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-headline-md text-headline-md text-ink-primary">Meal Bundles</h1>
        <p className="text-sm text-ink-secondary">Curated combinations for your goals</p>
      </div>

      <div className="px-gutter pt-6 flex flex-col gap-6">
        {bundles.map((bundle) => (
          <div key={bundle.id} className="rounded-3xl border border-line bg-surface p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-block px-2 py-1 rounded-full bg-surface-raised border border-line font-label-caps text-[10px] text-primary uppercase tracking-widest mb-2">
                  {bundle.badge}
                </span>
                <h2 className="font-headline-md text-xl text-ink-primary mb-1">{bundle.title}</h2>
                <p className="text-sm text-ink-secondary">{bundle.desc}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <div className="font-clinical-data text-lg text-gold-text">
                  {formatPaise(bundle.totalPaise)}
                </div>
                <div className="font-label-caps text-[10px] text-ink-muted uppercase mt-1">
                  {bundle.mealCount} Meals
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              {bundle.dishes.slice(0, 4).map((dish) => (
                <div key={dish.id} className="flex items-center gap-2 rounded-xl bg-surface-raised p-2 border border-line">
                  <div className="relative w-10 h-10 rounded-md overflow-hidden bg-surface flex-shrink-0">
                    <SafeImage src={dish.image ?? ""} alt={dish.name} className="h-full w-full" />
                  </div>
                  <span className="text-xs font-semibold text-ink-primary line-clamp-2">{dish.name}</span>
                </div>
              ))}
              {bundle.dishes.length > 4 && (
                <div className="flex items-center justify-center rounded-xl bg-surface-raised border border-line p-2 text-xs text-ink-secondary font-semibold">
                  +{bundle.dishes.length - 4} more
                </div>
              )}
            </div>

            <button className="w-full mt-2 rounded-full bg-gold px-4 py-3 text-sm font-bold tracking-tight text-[var(--gold-ink)] hover:bg-gold/90 transition-transform active:scale-[0.98]">
              Select Bundle
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
