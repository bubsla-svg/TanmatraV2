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
 * Safely resolve initial diet chip state for signed-in customers.
 * Gates on getAuthUser (the ADDENDUM-7 gotcha) since GET /preferences returns 200 { preferences: null }
 * even for anonymous traffic. Never writes back on changes (deferred to D-OB3).
 */
export async function resolveInitialDietChip(
  fetchImpl?: FetchImpl,
): Promise<DietFilterChip> {
  try {
    const auth = await getAuthUser(fetchImpl);
    if (!auth.user) return "all";

    const { preferences } = await getPreferences(fetchImpl);
    if (!preferences) return "all";

    if (preferences.dietaryStyle === "vegetarian" || preferences.dietaryStyle === "vegan") {
      return "veg";
    }
  } catch {
    /* Anonymous, offline, or session timeout -> degrade cleanly to "all" */
  }
  return "all";
}
