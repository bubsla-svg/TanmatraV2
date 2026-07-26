import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { BundleOfferCard } from "@/components/deals/BundleOfferCard";
import { DealsFilterBar } from "@/components/deals/DealsFilterBar";

export const metadata: Metadata = {
  title: "Clinical Meal Deals & Macro Value Combinations | Tanmatra",
  description: "Maximize nutritional efficacy per rupee with chef-curated bundle packs and real-time macronutrient density sorting.",
};

export default async function MealDealsPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Nutritional Efficiency
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Clinical Value & &Agrave;-la-carte Deals
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Evaluate therapeutic gastronomy by measurable physiological density—whether maximizing muscle recovery protein per rupee or securing multi-day chef recurring discounts.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-ink">Featured Chef & Advisory Combo Bundles</h2>
        <BundleOfferCard />
      </div>

      <div className="flex flex-col gap-5 pt-4 border-t border-line">
        <div>
          <h2 className="text-lg font-semibold text-ink">Live Menu Value Density Engine</h2>
          <p className="text-xs text-ink-muted mt-1">
            Sort daily kitchen offerings by verified laboratory macronutrient ratios per ₹100 spent.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-ink-muted">Loading live macro density valuations…</p>}>
          <DealsFilterBar dishes={dishes} />
        </Suspense>
      </div>
    </section>
  );
}
