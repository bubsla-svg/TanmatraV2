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
        {/* WCAG 1.3.1 (heading-order): every DishCard below titles itself with
            an h3, so while this line was a <p> the route ran h1 -> h3 with no
            level 2 in between — measured on the live page, not inferred. This
            sentence is already the on-screen label for the list underneath it,
            so it becomes the h2 rather than a hidden duplicate of itself.

            font-sans and font-normal are load-bearing, not decoration:
            lib/themes/tanmatra.css paints :where(h1..h6) with
            --font-family-heading (Fraunces) and :where(h2) at
            --font-weight-semibold, inside a @layer that app/layers.css ranks
            ABOVE Tailwind Preflight — so Preflight's font-size/font-weight
            reset never reaches here. text-sm sets only size and line-height,
            text-ink-muted only colour, so without these two utilities the line
            would silently switch from DM Sans 400 to Fraunces 600. With them
            the h2 is computed-style identical to the <p> it replaces. */}
        <h2 className="font-sans font-normal text-sm text-ink-muted">Dishes matching your metabolic profile</h2>
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
