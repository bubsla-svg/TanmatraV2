"use client";
// Client island: the metabolic goal toggle. Flipping fat-loss / muscle-gain
// re-filters the LIVE catalog (server-passed) and re-points the recommended
// plan. Pricing is never here — the program cards below are server-quoted.
import { useState, useMemo } from "react";
import Link from "next/link";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { planDisplay } from "@/lib/plans";
import { GOALS, type GoalId, type MetabolicGoal } from "@/content/landing/metabolic";

/** Slim projection of a catalog dish — only what the preview needs. */
export interface MetabolicDish {
  slug: string;
  name: string;
  image: string;
  isVeg: boolean;
  gi: "low" | "medium" | "high";
  protein: number;
  fiber: number;
  calories: number;
}

function pick(dishes: MetabolicDish[], goal: MetabolicGoal): MetabolicDish[] {
  if (goal.filter === "high_protein") {
    return dishes.filter((d) => d.protein >= 18).sort((a, b) => b.protein - a.protein).slice(0, 6);
  }
  return dishes
    .filter((d) => d.gi !== "high" && d.fiber >= 4)
    .sort((a, b) => a.calories - b.calories)
    .slice(0, 6);
}

function stat(d: MetabolicDish, goal: MetabolicGoal): string {
  return goal.filter === "high_protein"
    ? `${Math.round(d.protein)}g protein · ${Math.round(d.calories)} kcal`
    : `${Math.round(d.calories)} kcal · ${Math.round(d.fiber)}g fibre`;
}

export function MetabolicExplorer({ dishes }: { dishes: MetabolicDish[] }) {
  const [goalId, setGoalId] = useState<GoalId>("fat_loss");
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]!;
  const preview = useMemo(() => pick(dishes, goal), [dishes, goal]);
  const plan = planDisplay(goal.planId);

  return (
    <div>
      <div role="group" aria-label="Choose your goal" className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        {GOALS.map((g) => {
          const on = g.id === goalId;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => setGoalId(g.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold transition-colors ${
                on ? "bg-gold text-[var(--gold-ink)]" : "text-ink-muted hover:text-ink"
              }`}
            >
              <LandingIcon name={g.icon} className="h-4 w-4" />
              {g.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">{goal.weekOneSub}</p>
      <p className="mt-2 text-sm">
        <span className="text-ink-faint">Recommended program: </span>
        <Link href={`/plan/${goal.planId}`} className="font-semibold text-gold-text hover:underline">
          {plan.name} &rarr;
        </Link>
      </p>

      {preview.length > 0 && (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {preview.map((d) => (
            <Link
              key={d.slug}
              href={`/dish/${d.slug}`}
              className="w-44 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <div className="relative h-28 bg-surface-raised">
                {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
                <img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute left-2 top-2 rounded bg-[var(--ink)]/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {d.isVeg ? "VEG" : "NON-VEG"}
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold text-ink">{d.name}</p>
                <p className="tabular mt-0.5 text-[10px] text-ink-muted">{stat(d, goal)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
