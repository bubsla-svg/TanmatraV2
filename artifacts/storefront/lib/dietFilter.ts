/**
 * Dietary filter chip helper module (OB-4 / II.4).
 * Enforces that user-initiated filter chips MAY hide dishes, in contrast to system
 * ranking which only orders and annotates.
 * Soft-auth safe: initial chip resolution explicitly gates on getAuthUser before
 * inspecting soft-authed GET /preferences responses.
 */
import { getAuthUser } from "./api";
import type { FetchImpl } from "./apiClient";
import { getPreferences } from "./preferencesApi";
import { recallDiet } from "./dietMemory";

export type DietFilterChip = "all" | "veg" | "non_veg";

export interface DietChipOption {
  key: DietFilterChip;
  label: string;
}

export const DIET_CHIP_OPTIONS: DietChipOption[] = [
  { key: "all", label: "All" },
  { key: "veg", label: "Veg" },
  { key: "non_veg", label: "Non-veg" },
];

/** Filter a list of dishes by the user-selected diet chip. */
export function filterDishesByDiet<T extends { isVeg: boolean }>(
  dishes: T[],
  chip: DietFilterChip,
): T[] {
  if (chip === "veg") return dishes.filter((d) => d.isVeg);
  if (chip === "non_veg") return dishes.filter((d) => !d.isVeg);
  return dishes;
}

/**
 * Safely resolve the initial diet chip.
 * Gates on getAuthUser (the ADDENDUM-7 gotcha) since GET /preferences returns 200 { preferences: null }
 * even for anonymous traffic. Never writes back on changes (deferred to D-OB3).
 *
 * Precedence, strongest first — the whole point of resolving it in ONE place:
 *
 *   1. A signed-in customer's stored preferences. A real profile they can see
 *      and edit; it decides the answer outright, including deciding it is
 *      "all" for an omnivore. Local memory never overrides it.
 *   2. What a signed-out visitor told us locally (lib/dietMemory) — the
 *      wizard's dietary-style answer, or a Veg/Non-veg chip they tapped.
 *      Reached when nobody is signed in, or when a signed-in account simply
 *      has no preferences row yet.
 *   3. "all".
 *
 * Step 2 is the fix for a real contradiction, not a convenience: the wizard's
 * `savePreferences` swallows the 401 a signed-out visitor gets, so before this
 * a strict vegetarian could answer the dietary-style question and then be shown
 * chicken on the very next screen.
 */
export async function resolveInitialDietChip(
  fetchImpl?: FetchImpl,
): Promise<DietFilterChip> {
  try {
    const auth = await getAuthUser(fetchImpl);
    if (auth.user) {
      const { preferences } = await getPreferences(fetchImpl);
      // A preferences row is a definite answer, "all" included — falling
      // through to local memory here would let a stale chip tap override the
      // profile the customer can actually see and edit.
      if (preferences) {
        return preferences.dietaryStyle === "vegetarian" || preferences.dietaryStyle === "vegan"
          ? "veg"
          : "all";
      }
    }
  } catch {
    /* Anonymous, offline, or session timeout -> fall back to local memory */
  }
  return recallDiet()?.chip ?? "all";
}
