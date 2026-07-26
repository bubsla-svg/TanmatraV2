"use client"; // Justification: client-side dietary filter chips, system preferences ranking overlay, and active chip state.
// Client: personalisation and diet-filter overlay on the server-rendered menu (OB-4 / II.4).
// User-initiated chips MAY hide dishes; system-inferred signals MAY ONLY rank and annotate.
// SSR initial paint outputs the full menu ("all" chip default) preserving SEO and indexing.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "@workspace/preferences-match";
import { apiGet } from "@/lib/apiClient";
import { MenuGrid } from "@/components/MenuGrid";
import { isMeaningful, rankDishes, type DishFit } from "@/lib/menuFit";
import {
  filterDishesByDiet,
  resolveInitialDietChip,
  DIET_CHIP_OPTIONS,
  type DietFilterChip,
} from "@/lib/dietFilter";

interface PrefsRow {
  allergens?: string[];
  dislikedIngredients?: string[];
  cuisines?: string[];
  dietaryStyle?: string;
  goal?: string | null;
  calorieTarget?: number | null;
  medicalConditions?: string[];
}

function toMatch(row: PrefsRow | null): PreferencesForMatch | null {
  if (!row) return null;
  return {
    allergens: row.allergens ?? [],
    dislikedIngredients: row.dislikedIngredients ?? [],
    cuisines: row.cuisines ?? [],
    dietaryStyle: (row.dietaryStyle as PreferencesForMatch["dietaryStyle"]) ?? "omnivore",
    goal: (row.goal as PreferencesForMatch["goal"]) ?? null,
    calorieTarget: row.calorieTarget ?? null,
    medicalConditions: row.medicalConditions ?? [],
  };
}

export function PersonalizedMenu({ dishes }: { dishes: DishData[] }) {
  const [prefs, setPrefs] = useState<PreferencesForMatch | null>(null);
  const [chip, setChip] = useState<DietFilterChip>("all");

  useEffect(() => {
    let live = true;
    apiGet<{ preferences: PrefsRow | null }>("/preferences")
      .then(({ preferences }) => {
        if (live) setPrefs(toMatch(preferences));
      })
      .catch(() => {
        // Signed out / offline — leave the default grid in place.
      });

    resolveInitialDietChip()
      .then((c) => {
        if (live && c !== "all") setChip(c);
      })
      .catch(() => {
        // Fallback cleanly to "all"
      });

    return () => {
      live = false;
    };
  }, []);

  const ranked = useMemo(() => {
    if (!prefs || !isMeaningful(prefs)) return null;
    return rankDishes(dishes, prefs);
  }, [prefs, dishes]);

  const orderedDishes = ranked ? ranked.map((r) => r.dish) : dishes;
  const filteredDishes = useMemo(
    () => filterDishesByDiet(orderedDishes, chip),
    [orderedDishes, chip],
  );
  const fits = ranked ? new Map<number, DishFit>(ranked.map((r) => [r.dish.id, r.fit])) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div role="group" aria-label="Filter dishes by diet" className="flex items-center gap-1.5">
          {DIET_CHIP_OPTIONS.map((opt) => {
            const active = chip === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setChip(opt.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                  active
                    ? "bg-gold text-[var(--gold-ink)] shadow-sm"
                    : "border border-line bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {ranked && (
          <p className="text-xs text-ink-muted">
            Sorted for your preferences.{" "}
            <Link href="/account/preferences" className="font-medium text-gold-text hover:underline">
              Edit
            </Link>
          </p>
        )}
      </div>
      <MenuGrid dishes={filteredDishes} fits={fits} />
    </div>
  );
}
