import type { Metadata } from "next";
import { fetchMenu } from "@/lib/catalog";
import { recommendMenu } from "@/lib/recommendations";
import { DishCard } from "@/components/DishCard";
import { buildSharedMacroKeys } from "@/lib/dishTrust";

export const metadata: Metadata = {
  title: "Recommendations",
};

export default async function MealRecommendationsPage() {
  const { dishes } = await fetchMenu();
  const recommendations = recommendMenu(dishes, { goal: "lose_weight" }, true); // mock pref
  // F-1: whole catalog, not the top-10 slice.
  const sharedMacroKeys = buildSharedMacroKeys(dishes);

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.10" data-screen-state="default" className="min-h-dvh flex flex-col bg-bg pb-24">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-display font-bold text-3xl text-primary">For You</h1>
        <p className="text-sm text-ink-muted">Dishes matching your metabolic profile</p>
      </div>

      <div className="px-gutter pt-6 flex flex-col gap-6">
        {recommendations.slice(0, 10).map(({ dish, badge, rationale }) => (
          <div key={dish.id} className="flex flex-col gap-3">
            <div className="px-1">
              <span className="inline-block px-2 py-1 rounded-full bg-secondary border border-line font-bold text-2xs text-primary uppercase tracking-widest mb-1">
                {badge}
              </span>
              <p className="text-xs text-ink-muted italic">{rationale}</p>
            </div>
            <DishCard dish={dish} sharedMacroKeys={sharedMacroKeys} />
          </div>
        ))}
        {recommendations.length === 0 && (
          <div className="py-10 text-center text-ink-muted">
            No recommendations found for your profile.
          </div>
        )}
      </div>
    </div>
  );
}
