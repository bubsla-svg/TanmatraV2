"use client"; // Justification: client-side dietary filter chips, system preferences ranking overlay, and active chip state.
// Client: personalisation and diet-filter overlay on the server-rendered menu (OB-4 / II.4).
// User-initiated chips MAY hide dishes; system-inferred signals MAY ONLY rank and annotate.
// SSR initial paint outputs the full menu ("all" chip default) preserving SEO and indexing.
//
// `rows` (pre-rendered DishCard markup, one per dish) come in from
// app/menu/page.tsx — a real Server Component — instead of this component
// building them from `dishes` itself. That is the whole RSC-boundary fix:
// this file only ever computes WHICH dish ids to reorder/hide/annotate, it
// never constructs a dish row, so DishCard's own markup and imports stay
// out of the client bundle. `dishes` is still needed here alongside `rows`
// because ranking/filtering are computed over the DishData themselves — only
// the rendering is server-side now.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DishForMatch, PreferencesForMatch } from "@workspace/preferences-match";
import { apiGet } from "@/lib/apiClient";
import { MenuGrid, type MenuGridRow } from "@/components/MenuGrid";
import { DishFitProvider } from "@/components/menu/DishFitContext";
import { isMeaningful, rankDishes } from "@/lib/menuFit";
import { computeMenuGridState } from "@/lib/menuGridState";
import {
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

export function PersonalizedMenu({
  dishes,
  rows,
}: {
  dishes: DishForMatch[];
  rows: MenuGridRow[];
}) {
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
        if (live && c !== "all") setChip((curr) => (curr === "all" ? c : curr));
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

  const { order, visibleIds, fits } = useMemo(
    () => computeMenuGridState(dishes, ranked, chip),
    [dishes, ranked, chip],
  );

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
                // D-08: selection state, not a rival action colour — border +
                // tint + marker, never a solid --gold fill (the mini-cart bar
                // is this screen's one gold action).
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                  active
                    ? "border-gold bg-gold/10 text-gold-text"
                    : "border-line bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {active && <span aria-hidden>✓ </span>}
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
      <DishFitProvider fits={fits}>
        <MenuGrid rows={rows} order={order} visibleIds={visibleIds} />
      </DishFitProvider>
    </div>
  );
}
