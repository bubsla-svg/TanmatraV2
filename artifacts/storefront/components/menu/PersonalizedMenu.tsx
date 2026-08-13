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
import {
  EMPTY_FILTERS,
  activeFilterLabels,
  countActiveFilters,
  filterDishes,
  type MenuFilterState,
} from "@/lib/menuFilters";
import { MenuFilterSheet } from "@/components/menu/MenuFilterSheet";

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
  const [filters, setFilters] = useState<MenuFilterState>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

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

  // The 5.3 sheet narrows on top of the diet chip rather than replacing it:
  // `visibleIds` already reflects the chip, so intersecting keeps both filters
  // honest and leaves the server-rendered rows/order untouched.
  const filteredIds = useMemo(() => {
    if (!countActiveFilters(filters)) return visibleIds;
    const survivors = new Set(filterDishes(dishes, filters).map((d) => d.id));
    return new Set([...visibleIds].filter((id) => survivors.has(id)));
  }, [dishes, filters, visibleIds]);

  const activeLabels = activeFilterLabels(filters);
  const noMatch = countActiveFilters(filters) > 0 && filteredIds.size === 0;

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
                aria-pressed={active}
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
        <div className="flex items-center gap-3">
          {ranked && (
            <p className="text-xs text-ink-muted">
              Sorted for your preferences.{" "}
              <Link href="/account/preferences" className="font-medium text-gold-text hover:underline">
                Edit
              </Link>
            </p>
          )}
          {/* Frosted, not gold — the mini-cart bar is this screen's one gold action. */}
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            data-testid="menu-filter-trigger"
            className="min-h-[44px] rounded-full border border-line bg-surface-raised px-4 text-xs font-semibold text-ink transition-transform active:scale-95"
          >
            Filter
            {activeLabels.length > 0 && (
              <span className="ml-1.5 text-gold-text">· {activeLabels.length}</span>
            )}
          </button>
        </div>
      </div>

      {activeLabels.length > 0 && (
        <p className="text-xs text-ink-muted" data-testid="menu-active-filters">
          Filtering by {activeLabels.join(" · ")}
        </p>
      )}

      {noMatch ? (
        <div
          data-ui-generation="stitch-74"
          data-screen-id="14.2"
          data-screen-state="no-match"
          data-testid="menu-no-match-empty"
          className="rounded-2xl border border-line bg-surface-raised px-6 py-12 text-center"
        >
          <h3 className="text-base font-semibold text-ink">Nothing matches every filter yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            You asked for {activeLabels.join(" · ")}. No dish on today&apos;s menu meets all of
            those at once.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              data-testid="menu-no-match-clear"
              className="min-h-[48px] rounded-full bg-gold px-6 text-sm font-bold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="min-h-[44px] rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-transform active:scale-95"
            >
              Adjust filters
            </button>
          </div>
        </div>
      ) : (
        <DishFitProvider fits={fits}>
          <MenuGrid rows={rows} order={order} visibleIds={filteredIds} />
        </DishFitProvider>
      )}

      <MenuFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={setFilters}
        matchCount={(draft) =>
          new Set(
            filterDishes(dishes, draft)
              .map((d) => d.id)
              .filter((id) => visibleIds.has(id)),
          ).size
        }
      />
    </div>
  );
}
