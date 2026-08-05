import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { SmartRecommendationsGrid } from "@/components/recommendations/SmartRecommendationsGrid";

export const metadata: Metadata = {
  title: "Smart Meal Recommendations | Tanmatra",
  description: "Personalised meal recommendations with transparent therapeutic reasoning and one-click cart add.",
};

/** Shimmer matching the final card geometry — the brief asks for a skeleton, not
 *  a spinner, so the grid does not jump when the recommendations resolve. */
function RecommendationsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="h-40 animate-pulse bg-surface-subtle" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-subtle" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-subtle" />
            <div className="h-3 w-full animate-pulse rounded bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** `/meal-recommendations` — ranked menu with per-dish therapeutic reasoning
 *  (Stitch brief 19). Ranking runs client-side over the server-passed catalog;
 *  prices and macros render verbatim from it. */
export default async function MealRecommendationsPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-[var(--space-section)]">
      <header className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-text">
          Prescriptive gastronomy
        </span>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
          Smart clinical recommendations
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
          Every recommended meal is evaluated against your macro profile and glycaemic thresholds, with
          the reasoning shown on the card.
        </p>
      </header>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <SmartRecommendationsGrid dishes={dishes} />
      </Suspense>
    </section>
  );
}
