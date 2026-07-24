"use client";
// Client: personalisation overlay on the (server-rendered) menu. On mount it
// reads the signed-in customer's preferences; when they carry a real signal it
// re-ranks the grid (best-fit first, allergen/diet conflicts last but still
// visible) and flags each conflict with the SAME shared evaluator the checkout
// safety gate uses — so the menu can't disagree with checkout. Signed out or a
// default profile → the plain grid in the server's order, so the SSR paint is
// the full menu and SEO + first paint are unaffected.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "@workspace/preferences-match";
import { apiGet } from "@/lib/apiClient";
import { MenuGrid } from "@/components/MenuGrid";
import { isMeaningful, rankDishes, type DishFit } from "@/lib/menuFit";

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

  useEffect(() => {
    let live = true;
    apiGet<{ preferences: PrefsRow | null }>("/preferences")
      .then(({ preferences }) => {
        if (live) setPrefs(toMatch(preferences));
      })
      .catch(() => {
        // Signed out / offline — leave the default grid in place.
      });
    return () => {
      live = false;
    };
  }, []);

  const ranked = useMemo(() => {
    if (!prefs || !isMeaningful(prefs)) return null;
    return rankDishes(dishes, prefs);
  }, [prefs, dishes]);

  if (!ranked) return <MenuGrid dishes={dishes} />;

  const orderedDishes = ranked.map((r) => r.dish);
  const fits = new Map<number, DishFit>(ranked.map((r) => [r.dish.id, r.fit]));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        Sorted for your preferences.{" "}
        <Link href="/account/preferences" className="font-medium text-gold-text hover:underline">
          Edit
        </Link>
      </p>
      <MenuGrid dishes={orderedDishes} fits={fits} />
    </div>
  );
}
