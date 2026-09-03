/**
 * Menu filter state, as URL search params (N2.2 native-feel plan —
 * URL-as-state). Pure and DOM-free, same reasoning as menuFilters.ts next
 * door: PersonalizedMenu is a client island, but the read/write mapping
 * between MenuFilterState and a query string is a data question, testable
 * without a browser or a Next router.
 *
 * Only COMMITTED state lives here. MenuFilterSheet's own in-progress draft
 * editing never reaches this module — only what onApply hands back.
 *
 * There used to be a `query` field backing an inline dish-name search box.
 * The box was removed on owner instruction (2026-08-16) — the Header's ⌘K
 * command menu already searches the same catalog from every route. `q` is
 * therefore no longer WRITTEN, but it is deliberately still MANAGED (see
 * MANAGED_PARAM_KEYS) so a bookmarked `/menu?q=bowl` is evicted rather than
 * left in the address bar implying a search that nothing performs.
 */
import type { DietFilterChip } from "./dietFilter";
import {
  normaliseBound,
  type AllergenFilter,
  type DietaryFilter,
  type GoalFilter,
  type MacroFilter,
  type MenuFilterState,
} from "./menuFilters";

const GOAL_KEYS: readonly GoalFilter[] = [
  "fat_loss",
  "glucose_steady",
  "high_protein",
  "gut_light",
  "energy_stable",
];
const DIETARY_KEYS: readonly DietaryFilter[] = ["vegetarian", "eggetarian", "chicken", "fish", "no_dairy"];
const ALLERGEN_KEYS: readonly AllergenFilter[] = ["peanut_free", "gluten_free", "soy_free"];
const MACRO_KEYS: readonly MacroFilter[] = ["under_400_kcal", "protein_30_plus", "lower_carb", "high_fiber"];

export interface MenuUrlState {
  chip: DietFilterChip;
  filters: MenuFilterState;
}

function parseGroup<T extends string>(raw: string | null, valid: readonly T[]): T[] {
  if (!raw) return [];
  const allowed = new Set<string>(valid);
  // Dedup with a Set — a hand-edited or double-applied URL ("?goal=a,a")
  // should not toggle a filter on twice; toggleFilter's own array already
  // guarantees this for in-app changes, but a URL is untrusted input.
  return [...new Set(raw.split(","))].filter((v): v is T => allowed.has(v));
}

/**
 * Reads committed menu state back out of the URL — the back-navigation
 * restore path this module exists for. Unknown or tampered values are
 * dropped rather than trusted, same as any other external input.
 */
export function parseMenuUrlState(params: URLSearchParams): MenuUrlState {
  const chipRaw = params.get("diet");
  const chip: DietFilterChip = chipRaw === "veg" || chipRaw === "non_veg" ? chipRaw : "all";
  return {
    chip,
    filters: {
      goal: parseGroup(params.get("goal"), GOAL_KEYS),
      dietary: parseGroup(params.get("dietary"), DIETARY_KEYS),
      allergen: parseGroup(params.get("allergen"), ALLERGEN_KEYS),
      macro: parseGroup(params.get("macro"), MACRO_KEYS),
      // Untrusted numbers — snapped to the slider grid or dropped.
      proteinMin: normaliseBound("proteinMin", params.get("pmin")),
      kcalMax: normaliseBound("kcalMax", params.get("kmax")),
    },
  };
}

/**
 * Inverse of parseMenuUrlState. Every default value (chip "all", an empty
 * filter group) is OMITTED rather than written as an empty param, so a
 * visitor who never touched a filter keeps a bare `/menu` URL.
 */
export function menuUrlStateToSearch(state: MenuUrlState): string {
  const params = new URLSearchParams();
  if (state.chip !== "all") params.set("diet", state.chip);
  if (state.filters.goal.length) params.set("goal", state.filters.goal.join(","));
  if (state.filters.dietary.length) params.set("dietary", state.filters.dietary.join(","));
  if (state.filters.allergen.length) params.set("allergen", state.filters.allergen.join(","));
  if (state.filters.macro.length) params.set("macro", state.filters.macro.join(","));
  if (state.filters.proteinMin != null) params.set("pmin", String(state.filters.proteinMin));
  if (state.filters.kcalMax != null) params.set("kmax", String(state.filters.kcalMax));
  return params.toString();
}

/** Every key this module owns — the set `mergeMenuUrlState` clears before
 *  re-writing, so a stale value (an allergen chip since deselected) can't
 *  survive a merge just because it wasn't touched this round.
 *
 *  `q` is in the list but never re-written: it is the retired search param,
 *  kept here purely so a link that still carries it gets it cleared. */
const MANAGED_PARAM_KEYS = ["diet", "goal", "dietary", "allergen", "macro", "pmin", "kmax", "q"] as const;

/**
 * Merges committed menu state into an ALREADY-EXISTING search params object,
 * rather than replacing the query string wholesale. Required because this
 * route's dish-card links (`?dish=slug`) and drawer are same-route
 * navigations built with their own hardcoded query string — a plain
 * `router.replace(pathname + "?" + menuUrlStateToSearch(...))` would silently
 * drop `?dish=` the moment the drawer opens, and a live sync effect watching
 * the URL for exactly this drift is what re-asserts diet/filters afterward
 * (see PersonalizedMenu.tsx) without stepping on `dish`.
 */
export function mergeMenuUrlState(current: URLSearchParams, state: MenuUrlState): string {
  const merged = new URLSearchParams(current);
  for (const key of MANAGED_PARAM_KEYS) merged.delete(key);
  for (const [key, value] of new URLSearchParams(menuUrlStateToSearch(state))) {
    merged.set(key, value);
  }
  return merged.toString();
}
