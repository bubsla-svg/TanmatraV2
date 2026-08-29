import type { Metadata } from "next";
import { fetchMenu } from "@/lib/catalog";
import { buildBundles } from "@/lib/mealBundles";
import { BundleCard } from "@/components/meal-deals/BundleCard";

export const metadata: Metadata = {
  title: "Meal Deals",
};

export default async function MealDealsPage() {
  const { dishes } = await fetchMenu();
  const bundles = buildBundles(dishes);

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.9" data-screen-state="default" className="min-h-dvh flex flex-col bg-bg pb-24">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-bold text-3xl text-ink">Meal Bundles</h1>
        <p className="text-sm text-ink-muted">Curated combinations for your goals</p>
      </div>

      <div className="px-gutter pt-6 flex flex-col gap-6">
        {/* The card is the interactive island (CLAUDE.md combo convention:
            one clickable card → drawer of constituent dishes → Add Combo).
            Its predecessor here was a handler-less gold button element in
            this Server Component — a dead end on a revenue surface, pinned
            against regression by mealBundles.test.ts. */}
        {bundles.map((bundle) => (
          <BundleCard key={bundle.id} bundle={bundle} />
        ))}
      </div>
    </div>
  );
}
