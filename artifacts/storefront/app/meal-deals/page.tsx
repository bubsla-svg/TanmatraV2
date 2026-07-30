import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { BundleOfferCard } from "@/components/deals/BundleOfferCard";
import { DealsFilterBar } from "@/components/deals/DealsFilterBar";
import { buildBundles, toBundleView } from "@/lib/mealBundles";

export const metadata: Metadata = {
  title: "Clinical Meal Deals & Macro Value Combinations | Tanmatra",
  description: "Maximize nutritional efficacy per rupee with curated combo packs and real-time macronutrient density sorting.",
};

/** Shimmer placeholder matching the final card geometry (brief 18/19: a skeleton,
 *  never a spinner, so the grid does not reflow when data lands). */
function DealsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-3xl border border-line bg-surface-subtle" />
      ))}
    </div>
  );
}

/** `/meal-deals` — combo packs plus the live value-density engine (Stitch brief
 *  18). Bundles are derived from the live catalog in lib/mealBundles: every
 *  amount is the sum of its constituents' server prices, and a bundle the
 *  catalog cannot fill is dropped rather than shown short. */
export default async function MealDealsPage() {
  const { dishes } = await fetchMenu();
  const bundles = buildBundles(dishes).map(toBundleView);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-[var(--space-section)] px-4 py-[var(--space-section)]">
      <header className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-text">
          Nutritional efficiency
        </span>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
          Clinical value &amp; à-la-carte deals
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
          Compare the menu by measurable density — protein per rupee, fibre per rupee — or take a
          multi-day combo built from the same live kitchen.
        </p>
      </header>

      {bundles.length > 0 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">Combo packs</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Each pack is a set of à-la-carte meals off today&rsquo;s menu. Open one to see exactly what
              is in it — the total is the sum of those dishes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => (
              <BundleOfferCard key={b.id} bundle={b} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 border-t border-line pt-[var(--space-section)]">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Live menu value density</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Sort today&rsquo;s kitchen by published macronutrient ratios per ₹100 spent.
          </p>
        </div>
        <Suspense fallback={<DealsSkeleton />}>
          <DealsFilterBar dishes={dishes} />
        </Suspense>
      </div>
    </section>
  );
}
