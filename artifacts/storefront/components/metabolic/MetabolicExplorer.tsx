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
import { SafeImage } from "@/components/ui/SafeImage";

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
  "tabular rounded-full border border-line bg-bg px-2.5 py-1 text-[10px] text-ink-muted";

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
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4">
        <div
          role="group"
          aria-label="Choose your goal"
          className="inline-flex w-max items-center gap-1 rounded-full bg-bg p-1"
        >
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
        <p className="max-w-xl text-sm leading-relaxed text-ink-muted">{goal.weekOneSub}</p>
        <p className="text-sm">
          <span className="text-ink-faint">Recommended program: </span>
          <Link href={`/plan/${goal.planId}`} className="font-semibold text-gold-text hover:underline">
            {plan.name} &rarr;
          </Link>
        </p>
      </div>

      {preview.length > 0 && (
        <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {preview.map((d) => (
            <Link
              key={d.slug}
              href={`/dish/${d.slug}`}
              className="w-64 shrink-0 snap-center overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-line-strong"
            >
              <div className="relative h-40 bg-surface-raised">
                <SafeImage src={d.image} className="h-full w-full" />
                <span
                  className={`absolute right-3 top-3 rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-md ${
                    d.isVeg ? "bg-sage-soft text-sage-text" : "bg-bg/80 text-[var(--danger)]"
                  }`}
                >
                  {d.isVeg ? "Veg" : "Non-veg"}
                </span>
              </div>
              <div className="flex flex-col gap-3 p-5">
                <h3 className="truncate text-base font-semibold leading-tight text-ink">{d.name}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className={chipCls}>{Math.round(d.protein)}g protein</span>
                  <span className={chipCls}>{Math.round(d.fiber)}g fibre</span>
                  <span className="tabular rounded-full border border-[var(--gold)]/30 bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-2.5 py-1 text-[10px] text-gold-text">
                    GI {d.gi}
                  </span>
                  <span className={chipCls}>{Math.round(d.calories)} kcal</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
