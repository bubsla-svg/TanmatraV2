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
import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollHide } from "@/lib/useScrollHide";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DishForMatch, PreferencesForMatch } from "@workspace/preferences-match";
import { apiGet } from "@/lib/apiClient";
import { MenuGrid, type MenuGridRow } from "@/components/MenuGrid";
import { DishFitProvider } from "@/components/menu/DishFitContext";
import { isMeaningful, rankDishes } from "@/lib/menuFit";
import { computeMenuGridState } from "@/lib/menuGridState";
import { resolveInitialDietChip, type DietFilterChip } from "@/lib/dietFilter";
import { forgetDiet, rememberDiet } from "@/lib/dietMemory";
import {
  EMPTY_FILTERS,
  activeFilterLabels,
  countActiveFilters,
  filterDishes,
  toggleFilter,
  type MenuFilterState,
} from "@/lib/menuFilters";
import { mergeMenuUrlState, parseMenuUrlState } from "@/lib/menuUrlState";
import { MenuFilterSheet } from "@/components/menu/MenuFilterSheet";
import { MenuControls } from "@/components/menu/MenuControls";
import { SectionChipBar, useStickyAnchorOffset } from "@/components/menu/SectionChipBar";
import { groupBySection, sectionAnchorId } from "@/lib/menuSections";
import { useScrollRestore } from "@/lib/useScrollRestore";
import Link from "next/link";

// N2.3: URL sync is debounced, not immediate. Chip/filter changes are
// discrete clicks, so a 400ms delay before the address bar updates is
// imperceptible — but the sheet applies a whole filter set at once and the
// re-assert effect below also fires on every same-route navigation, so
// coalescing keeps this to one router.replace per settled state.
const URL_SYNC_DEBOUNCE_MS = 400;

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [prefs, setPrefs] = useState<PreferencesForMatch | null>(null);
  // Seeded from the URL (lazy initializer — runs once, at mount only), so a
  // filtered view survives the unmount/remount that back-navigation causes.
  // A URL-provided value counts as already-chosen, same as a manual click:
  // resolveInitialDietChip's own guard below only ever upgrades FROM "all".
  const [chip, setChip] = useState<DietFilterChip>(() => parseMenuUrlState(searchParams).chip);
  const [filters, setFilters] = useState<MenuFilterState>(
    () => parseMenuUrlState(searchParams).filters,
  );
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

  // Law 4: a chip tap is the visitor telling us how they want to eat, and it
  // used to live only in this component's state and the URL — so the wizard,
  // two taps away, started again from "Omnivore". Recorded as "filtered", the
  // weaker fact: a request to narrow a list, never a declared dietary identity
  // (lib/dietMemory), so it can never overwrite the wizard's own answer.
  function handleChipChange(next: DietFilterChip) {
    setChip(next);
    if (next === "all") forgetDiet();
    else rememberDiet({ chip: next, source: "filtered" });
  }

  // Committed state -> URL, debounced. MenuFilterSheet's own draft editing
  // never reaches this effect — only what onApply hands back as `filters`.
  //
  // A merge, not a from-scratch replace, and `searchParams` is a dependency
  // here on purpose: the dish-card links and drawer are same-route
  // navigations built with their own hardcoded `?dish=slug` query string, so
  // opening a dish drops diet/filters from the URL the instant it navigates
  // — well before any unmount. Watching searchParams lets this effect notice
  // that drift and re-assert its own params (merged, so `?dish=` survives)
  // rather than only ever reacting to ITS OWN state changing, which would
  // let the very first same-route navigation erase everything this fix
  // exists to preserve.
  useEffect(() => {
    const id = setTimeout(() => {
      const desired = mergeMenuUrlState(searchParams, { chip, filters });
      if (desired === searchParams.toString()) return;
      router.replace(desired ? `${pathname}?${desired}` : pathname, { scroll: false });
    }, URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [chip, filters, pathname, router, searchParams]);

  const ranked = useMemo(() => {
    if (!prefs || !isMeaningful(prefs)) return null;
    return rankDishes(dishes, prefs);
  }, [prefs, dishes]);

  const { order, visibleIds, fits } = useMemo(
    () => computeMenuGridState(dishes, ranked, chip),
    [dishes, ranked, chip],
  );

  // The 5.3 sheet narrows on top of the diet chip rather than replacing it:
  // `visibleIds` already reflects the chip, so intersecting keeps both
  // filters honest and leaves the server-rendered rows/order untouched.
  const filteredIds = useMemo(() => {
    if (!countActiveFilters(filters)) return visibleIds;
    const survivors = new Set(filterDishes(dishes, filters).map((d) => d.id));
    return new Set([...visibleIds].filter((id) => survivors.has(id)));
  }, [dishes, filters, visibleIds]);

  const activeLabels = activeFilterLabels(filters);
  const noMatch = activeLabels.length > 0 && filteredIds.size === 0;

  // The chip bar's anchors are derived from exactly what MenuGrid will draw:
  // the same `rows`, grouped the same way, filtered by the same
  // `filteredIds`. Deriving rather than duplicating is what guarantees the
  // two can never disagree about which sections exist.
  const sectionAnchors = useMemo(
    () =>
      groupBySection(rows, (r) => r.sectionOrder)
        .filter((s) => s.items.some((r) => filteredIds.has(r.dishId)))
        .map((s) => ({ id: sectionAnchorId(s.order), label: s.name })),
    [rows, filteredIds],
  );

  const stickyRef = useRef<HTMLDivElement>(null);
  useStickyAnchorOffset(stickyRef);
  const headerHidden = useScrollHide(false);

  // §3.9 / Law 3. Disabled while a dish drawer is open (`?dish=`): that is a
  // same-route overlay whose own close already restores position, and
  // writing a position while it is open would capture the scroll of the
  // drawer, not of the list underneath it.
  useScrollRestore("menu", !searchParams.get("dish"));

  return (
    <div className="flex flex-col gap-4">
      {/* §3.2 / T-13: ONE sticky strip. The diet chips, the Filters trigger,
          the goal chips and the section chips ride in the same horizontal
          rail — one 48px row instead of two stacked ones, so the pinned
          chrome on /menu is the header plus this and nothing else, and the
          first dish's photo is in the first viewport. There is no collapse-
          on-scroll any more because there is nothing left to collapse.
          useStickyAnchorOffset measures this element to land jumped-to
          sections just below it.

          `min-h-16 justify-center`: the global Header is sticky, 63px, at the
          SAME z (--z-chrome). It used to be covered by this strip by document
          order whenever both pinned — which made the header's location
          trigger, search and theme toggle unreachable on /menu after the
          first scroll (Law 1 keeps the location trigger visible). PR-11c: the
          strip now pins just below the header while the header is revealed
          and takes the top edge only while the header has retreated — read
          off the same scroll stream (`useScrollHide`) the header and the
          tab bar already share, so the three move together.

          `transition-[top]` animates a layout property, which is normally the
          wrong choice — but a transform cannot substitute here. `top` on a
          sticky element has NO effect until the element actually sticks, which
          is exactly the semantics this needs; `translateY` applies always, and
          useScrollHide flips after 12px of scroll, long before the strip is
          stuck. Swapping in a transform would shove the strip 63px out of
          place while it is still in flow. Kept deliberately, and it fires on a
          state flip rather than per frame. */}
      <div
        ref={stickyRef}
        className={`sticky z-[var(--z-chrome)] -mx-4 flex min-h-16 flex-col justify-center gap-1.5 bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 py-2 backdrop-blur transition-[top] duration-200 motion-reduce:transition-none ${
          headerHidden ? "top-0" : "top-[63px]"
        }`}
      >
        {/* Section anchors are derived from the SAME rows/visibleIds MenuGrid
            draws, so a section whose dishes are all filtered out loses its
            chip at the moment it loses its heading (Law 9). */}
        <SectionChipBar
          anchors={sectionAnchors}
          leading={
            <MenuControls
              chip={chip}
              onChipChange={handleChipChange}
              activeFilterCount={activeLabels.length}
              onOpenFilter={() => setFilterOpen(true)}
              goals={filters.goal}
              onToggleGoal={(goal) => setFilters((f) => toggleFilter(f, "goal", goal))}
            />
          }
        />

        {(activeLabels.length > 0 || ranked !== null) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {activeLabels.length > 0 && (
              <span data-testid="menu-active-filters">Filtering by {activeLabels.join(" · ")}</span>
            )}
            {ranked !== null && (
              <span>
                Sorted for your preferences.{" "}
                <Link href="/account/preferences" className="font-medium text-gold-text hover:underline">
                  Edit
                </Link>
              </span>
            )}
          </p>
        )}
      </div>

      {noMatch ? (
        <div
          data-ui-generation="stitch-74"
          data-screen-id="14.2"
          data-screen-state="no-match"
          data-testid="menu-no-match-empty"
          className="rounded-2xl border border-line bg-surface-raised px-6 py-12 text-center"
        >
          <h3 className="text-base font-semibold text-ink">Nothing matches yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            You asked for {activeLabels.join(" · ")}. No dish on today&apos;s menu meets all of
            those at once.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              data-testid="menu-no-match-clear"
              className="min-h-[48px] rounded-full bg-gold px-6 text-sm font-bold text-gold-ink transition-transform active:scale-[0.98]"
            >
              Clear all
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
