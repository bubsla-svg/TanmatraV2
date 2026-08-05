"use client";
// Client: smart meal recommendations grid for `/meal-recommendations`
// (Stitch brief 19). The goal and condition gates re-rank the server-passed
// catalog; no pricing decision happens here.
//
// The goal value used to be cast through `as any`, which hid a real bug: the
// "Longevity" tab passed goal "maintenance", and WellnessGoal has no such member
// (it is "general_wellness"), so that tab silently ranked against an unknown
// goal. Both casts are gone and the union is honoured.
import { useState, useMemo } from "react";
import type { DishData } from "@workspace/menu-catalog";
import type { WellnessGoal } from "@workspace/preferences-match";
import { recommendMenu } from "@/lib/recommendations";
import { RecommendationCard } from "./RecommendationCard";

const GOALS: { id: WellnessGoal; label: string }[] = [
  { id: "general_wellness", label: "Longevity" },
  { id: "lose_weight", label: "Fat loss" },
  { id: "gain_muscle", label: "Hypertrophy" },
];

const CONDITIONS: { id: string; label: string }[] = [
  { id: "none", label: "General" },
  { id: "pcos", label: "PCOS" },
  { id: "diabetes", label: "Diabetes" },
];

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
    on
      ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-gold-text"
      : "border-line text-ink-muted hover:border-line-strong"
  }`;

export function SmartRecommendationsGrid({ dishes }: { dishes: DishData[] }) {
  const [goal, setGoal] = useState<WellnessGoal>("general_wellness");
  const [condition, setCondition] = useState<string>("none");

  const recs = useMemo(
    () =>
      recommendMenu(
        dishes,
        {
          goal,
          medicalConditions: condition !== "none" ? [condition] : [],
          dietaryStyle: "omnivore",
        },
        true,
      ),
    [dishes, goal, condition],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Active goal</p>
          <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={goal === g.id}
                onClick={() => setGoal(g.id)}
                className={chip(goal === g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Condition gate</p>
          <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={condition === c.id}
                onClick={() => setCondition(c.id)}
                className={chip(condition === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {recs.length === 0 ? (
        <p className="rounded-3xl border border-line bg-surface p-6 text-sm text-ink-muted">
          Nothing on today&rsquo;s menu clears that combination. Try a different condition gate.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recs.slice(0, 10).map((r) => (
            <RecommendationCard key={r.dish.id} recommendation={r} />
          ))}
        </div>
      )}
    </div>
  );
}
