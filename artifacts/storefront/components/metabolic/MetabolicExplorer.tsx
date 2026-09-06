"use client";
// Client island: the metabolic goal toggle (Stitch brief 15 restyle). Flipping
// fat-loss / muscle-gain re-filters the LIVE catalog (server-passed) and
// re-points the recommended plan. Pricing is never here — the program cards
// below are server-quoted.
import { useState, useMemo } from "react";
import Link from "next/link";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { planDisplay } from "@/lib/plans";
import { GOALS, type GoalId, type MetabolicGoal } from "@/content/landing/metabolic";
import { DishImage } from "@/components/menu/DishImage";
import { Rail } from "@/components/primitives/Rail";

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

const chipCls =
  "font-data rounded-full bg-secondary px-2.5 py-1 text-2xs font-bold text-primary";

/**
 * Macro chips are labelled in full ("42g protein", not "42P"). The compressed
 * single-letter form the brief's mock uses is ambiguous between fat and fibre,
 * and this surface publishes clinical data — a mislabelled macro is worse than
 * a wider chip.
 */
export function MetabolicExplorer({ dishes }: { dishes: MetabolicDish[] }) {
  const [goalId, setGoalId] = useState<GoalId>("fat_loss");
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]!;
  const preview = useMemo(() => pick(dishes, goal), [dishes, goal]);
  const plan = planDisplay(goal.planId);

  return (
    // min-w-0: this is the second item of app/metabolic/page.tsx's
    // `grid ... lg:grid-cols-2` header. A grid item's default min-width is
    // `auto`, not 0 — the dish-preview rail below is 6 cards wide
    // (overflow-x-auto, meant to scroll internally), and without this the
    // grid track refused to shrink below the rail's full unscrolled width,
    // pushing the whole page to a measured 1632px in a 360px viewport.
    <div className="min-w-0">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <div
          role="group"
          aria-label="Choose your goal"
          className="flex flex-wrap gap-2"
        >
          {GOALS.map((g) => {
            const on = g.id === goalId;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => setGoalId(g.id)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors active:scale-[0.98] ${
                  on ? "border-gold bg-primary/10 text-primary" : "border-transparent bg-secondary text-ink-muted"
                }`}
              >
                <LandingIcon name={g.icon} className="h-4 w-4" />
                {g.label}
              </button>
            );
          })}
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-ink-muted">{goal.weekOneSub}</p>
        <p className="text-sm">
          <span className="text-ink-faint">Recommended program: </span>
          <Link href={`/plan/${goal.planId}`} className="font-semibold text-primary hover:underline">
            {plan.name} &rarr;
          </Link>
        </p>
      </div>

      {preview.length > 0 && (
        <Rail snap="center" className="mt-4 gap-4 pb-2">
          {preview.map((d) => (
            <Link
              key={d.slug}
              href={`/dish/${d.slug}`}
              className="w-64 shrink-0 snap-center overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong"
            >
              <div className="relative h-40 bg-surface-raised">
                <DishImage src={d.image} name={d.name} className="h-full w-full" />
                <span
                  className={`absolute right-3 top-3 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.16em] backdrop-blur-md ${
                    d.isVeg ? "bg-sage-soft text-sage-text" : "bg-bg/80 text-danger"
                  }`}
                >
                  {d.isVeg ? "Veg" : "Non-veg"}
                </span>
              </div>
              <div className="flex flex-col gap-3 p-5">
                <h3 className="line-clamp-2 font-display text-lg font-semibold leading-tight text-primary">{d.name}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className={chipCls}>{Math.round(d.protein)}g protein</span>
                  <span className={chipCls}>{Math.round(d.fiber)}g fibre</span>
                  <span className={chipCls}>
                    GI {d.gi}
                  </span>
                  <span className={chipCls}>{Math.round(d.calories)} kcal</span>
                </div>
              </div>
            </Link>
          ))}
        </Rail>
      )}
    </div>
  );
}
