"use client";
// Client: dynamic smart meal recommendations grid with interactive preference adjustments.
import { useState, useMemo } from "react";
import type { DishData } from "@workspace/menu-catalog";
import { recommendMenu } from "@/lib/recommendations";
import { RecommendationCard } from "./RecommendationCard";

export function SmartRecommendationsGrid({ dishes }: { dishes: DishData[] }) {
  const [goal, setGoal] = useState<"lose_weight" | "gain_muscle" | "maintenance">("maintenance");
  const [condition, setCondition] = useState<string>("none");

  const recs = useMemo(() => {
    return recommendMenu(
      dishes,
      {
        goal,
        medicalConditions: condition !== "none" ? [condition] : [],
        dietaryStyle: "omnivore",
      } as any,
      true,
    );
  }, [dishes, goal, condition]);

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wide mr-1">Active Goal:</span>
          {[
            { id: "maintenance", label: "Longevity" },
            { id: "lose_weight", label: "Fat Loss" },
            { id: "gain_muscle", label: "Hypertrophy" },
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => setGoal(g.id as any)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                goal === g.id ? "border-gold bg-gold text-white shadow-sm" : "border-line bg-surface text-ink-muted hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wide mr-1">Condition Gate:</span>
          {[
            { id: "none", label: "General" },
            { id: "pcos", label: "PCOS" },
            { id: "diabetes", label: "Diabetes" },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCondition(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                condition === c.id ? "border-gold bg-gold text-white shadow-sm" : "border-line bg-surface text-ink-muted hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {recs.slice(0, 10).map((r) => (
          <RecommendationCard key={r.dish.id} recommendation={r} />
        ))}
      </div>
    </div>
  );
}
