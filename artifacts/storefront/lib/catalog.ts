import { DISHES, type DishData } from "@workspace/menu-catalog";

/**
 * Server-side catalog fetch. Reads the LIVE catalog API (the DB-merged,
 * RD-review-filtered public menu) and falls back to the static catalog package
 * when the API is unreachable — the same resilience the current app relies on,
 * so the menu grid always server-renders instead of blanking.
 *
 * The API is the source of truth for price/availability; the fallback is a
 * last resort so a cold API never yields an empty page.
 */

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

export interface MenuResult {
  dishes: DishData[];
  source: "api" | "fallback";
}

function availableFallback(): DishData[] {
  return DISHES.filter((d) => d.isAvailable !== false);
}

export async function fetchMenu(): Promise<MenuResult> {
  try {
    const res = await fetch(`${API_BASE}/api/menu/public`, {
      // Revalidate hourly — the menu is not per-request data.
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`menu ${res.status}`);
    const data = (await res.json()) as { dishes?: DishData[] };
    if (!data.dishes?.length) throw new Error("empty menu");
    return { dishes: data.dishes, source: "api" };
  } catch {
    return { dishes: availableFallback(), source: "fallback" };
  }
}

export function findDish(slug: string, dishes: DishData[]): DishData | undefined {
  return dishes.find((d) => d.slug === slug);
}
