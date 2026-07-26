import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { SmartRecommendationsGrid } from "@/components/recommendations/SmartRecommendationsGrid";

export const metadata: Metadata = {
  title: "AI Smart Meal Recommendations | Tanmatra",
  description: "Personalized culinary prescriptions with AI clinical therapeutic reasoning and 1-click nutritional cart activation.",
};

export default async function MealRecommendationsPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Prescriptive Gastronomy
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Smart Clinical Recommendations
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Every recommended meal is evaluated against your biological macro profile and glycemic index thresholds, accompanied by transparent therapeutic reasoning.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-ink-muted">Synthesizing clinical meal profiles…</p>}>
        <SmartRecommendationsGrid dishes={dishes} />
      </Suspense>
    </section>
  );
}
