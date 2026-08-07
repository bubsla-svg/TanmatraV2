import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { MealHistoryDashboard } from "@/components/history/MealHistoryDashboard";

export const metadata: Metadata = {
  title: "Meal History & Macro Dashboard | Tanmatra",
  description: "Inspect verified clinical nutritional logs and evaluate cumulative daily macronutrient target compliance over time.",
};

export default function MealHistoryPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-8">
      <AccountNav active="history" />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Nutritional Telemetry
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Meal History Dashboard
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Track cumulative macronutrient assimilation across automated recurring deliveries and evaluate adherence against registered dietitian daily prescription ceilings.
        </p>
      </div>

      <MealHistoryDashboard />
    </section>
  );
}
