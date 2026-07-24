"use client";
// Recipes browser — client-side filtering over the server-rendered list (SSR
// paints the full grid → SEO-safe; filtering is in-memory, no re-fetch, since
// the API caps the list at a browsable size).
import { useMemo, useState } from "react";
import type { Recipe } from "@/lib/recipesApi";
import { RecipeCard } from "./RecipeCard";

const GOALS: [string, string][] = [
  ["all", "All goals"], ["general_wellness", "Wellness"], ["lose_weight", "Lose weight"],
  ["gain_muscle", "Gain muscle"], ["maintain", "Maintain"],
];
const DIETS: [string, string][] = [
  ["all", "Any diet"], ["omnivore", "Omnivore"], ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"], ["pescatarian", "Pescatarian"], ["keto", "Keto"],
];
const TIMES: [number, string][] = [[0, "Any time"], [15, "≤15 min"], [30, "≤30 min"], [45, "≤45 min"]];

function Chips<T extends string | number>(props: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={props.label}>
      {props.options.map(([v, l]) => {
        const on = v === props.value;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => props.onChange(v)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-[var(--gold)] bg-gold text-[var(--gold-ink)]" : "border-line text-ink-muted hover:text-ink"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function RecipesBrowser({ recipes }: { recipes: Recipe[] }) {
  const [goal, setGoal] = useState("all");
  const [diet, setDiet] = useState("all");
  const [maxTime, setMaxTime] = useState(0);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return recipes.filter(
      (r) =>
        (goal === "all" || r.goal === goal) &&
        (diet === "all" || r.diet === diet) &&
        (maxTime === 0 || r.timeMinutes <= maxTime) &&
        (!term || r.title.toLowerCase().includes(term) || r.summary.toLowerCase().includes(term)),
    );
  }, [recipes, goal, diet, maxTime, q]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search recipes…"
        aria-label="Search recipes"
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-line-strong"
      />
      <div className="mt-4 flex flex-col gap-2">
        <Chips options={GOALS} value={goal} onChange={setGoal} label="Filter by goal" />
        <Chips options={DIETS} value={diet} onChange={setDiet} label="Filter by diet" />
        <Chips options={TIMES} value={maxTime} onChange={setMaxTime} label="Filter by time" />
      </div>
      <p className="mt-5 text-xs text-ink-faint">
        {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
      </p>
      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink-muted">No recipes match those filters.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.slug} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}
