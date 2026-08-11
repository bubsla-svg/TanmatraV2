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

/**
 * The live catalog references dish photography two ways: absolute URLs
 * (Unsplash stock) and legacy root-relative paths. The photo library is
 * served by the legacy app at BOTH `/dishes/<f>` and `/images/dishes/<f>`,
 * but the storefront only proxies `/images/*` (next.config rewrites) — so an
 * api-supplied `/dishes/<f>` 404s here and the card renders a blank box.
 * Map it onto the proxied `/images/dishes/` path — the catalog's own
 * documented convention and the lighter resized variant. Absolute URLs and
 * already-`/images/` paths pass through untouched.
 */
export function toProxiedImage(url: string): string {
  return url.startsWith("/dishes/") ? `/images${url}` : url;
}

/** Normalize every image reference on a dish to the storefront's proxy path. */
export function normalizeDishImages(dish: DishData): DishData {
  return {
    ...dish,
    image: toProxiedImage(dish.image),
    ...(dish.imageIngredient && { imageIngredient: toProxiedImage(dish.imageIngredient) }),
    ...(dish.imageDelivered && { imageDelivered: toProxiedImage(dish.imageDelivered) }),
    ...(dish.imageLifestyle && { imageLifestyle: toProxiedImage(dish.imageLifestyle) }),
    ...(dish.imagePackaging && { imagePackaging: toProxiedImage(dish.imagePackaging) }),
  };
}

function availableFallback(): DishData[] {
  return DISHES.filter((d) => d.isAvailable !== false);
}

/** The live fetch both fetchMenu() and checkMenuSource() share — throws with
 *  a specific reason on any non-success outcome so callers can tell api-down
 *  from empty-menu without re-deriving it. */
async function fetchLiveMenu(): Promise<DishData[]> {
  const res = await fetch(`${API_BASE}/api/menu/public`, {
    // Revalidate hourly — the menu is not per-request data.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`menu ${res.status}`);
  const data = (await res.json()) as { dishes?: DishData[] };
  if (!data.dishes?.length) throw new Error("empty menu");
  return data.dishes;
}

/** D-06: one Sentry event per fallback, fire-and-forget — same dynamic
 *  import + DSN gate as app/global-error.tsx / SegmentError.tsx, so a build
 *  with no DSN configured pays nothing and reports nothing. */
function reportMenuFallback(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const reason = error instanceof Error ? error.message : String(error);
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureMessage("Menu catalog fell back to static data", {
      level: "warning",
      extra: { reason },
    });
  });
}

/**
 * Server-side catalog fetch (see file header). `reportFallback` is injectable
 * (default: reportMenuFallback) purely so tests can assert the fallback path
 * fires the event without reaching into the real Sentry SDK — every other
 * caller (MenuPage, DishPage) takes the default.
 */
export async function fetchMenu(
  reportFallback: (error: unknown) => void = reportMenuFallback,
): Promise<MenuResult> {
  try {
    const dishes = await fetchLiveMenu();
    return { dishes: dishes.map(normalizeDishImages), source: "api" };
  } catch (error) {
    reportFallback(error);
    return { dishes: availableFallback(), source: "fallback" };
  }
}

/**
 * D-06(c): the `x-menu-source` signal for ops, read by middleware.ts.
 *
 * This is NOT called from fetchMenu() — it exists because Next.js Server
 * Components cannot set outgoing response headers (`next/headers`'s
 * `headers()` is explicitly read-only), so /menu and /dish/[slug] have no
 * way to stamp their own response. Middleware is the only layer in the App
 * Router that can. It calls the same `${API_BASE}/api/menu/public` URL with
 * the same `revalidate: 3600` window as fetchLiveMenu(), so it shares Next's
 * fetch cache with the page's own fetchMenu() call — in steady state this
 * resolves from cache, not a second network round-trip; only a true
 * cache-miss (at most once per revalidate window) pays for a real fetch.
 * Deliberately does not import DISHES — middleware may run on the Edge
 * runtime and the static fallback catalog has no reason to be in that bundle.
 */
export async function checkMenuSource(): Promise<MenuResult["source"]> {
  try {
    await fetchLiveMenu();
    return "api";
  } catch {
    return "fallback";
  }
}

export function findDish(slug: string, dishes: DishData[]): DishData | undefined {
  return dishes.find((d) => d.slug === slug);
}

export interface SourcingNote {
  area: string;
  detail: string;
}

export const KITCHEN_SOURCING: Record<string, SourcingNote[]> = {
  continental: [
    { area: "Dairy & eggs", detail: "Cage-free eggs from a Maharashtra co-op; A2 milk from a partner farm in Pune." },
    { area: "Greens & herbs", detail: "Hydroponic basil, kale, and lettuce from a Lonavla glasshouse — harvested the morning of cooking." },
    { area: "Oils", detail: "Cold-pressed extra-virgin olive oil and sunflower oil; no refined or palm-derived oils." },
  ],
  asian: [
    { area: "Aromatics & broths", detail: "Lemongrass, galangal, and kaffir lime from a Coorg estate; vegetable stock made daily, never cubes." },
    { area: "Sauces", detail: "Low-sodium soy reduced in-house with mirin and rice vinegar — no MSG, no caramel colour." },
    { area: "Grains", detail: "Single-origin jasmine and brown rice; soaked the night before to lower the glycaemic load." },
  ],
  indian: [
    { area: "Spices", detail: "Whole spices ground weekly at our Noida spice room — no pre-mixed masalas." },
    { area: "Dals & legumes", detail: "Single-origin moong, masoor, and chana from a Vidarbha farmer collective; sorted and re-cleaned in-house." },
    { area: "Dairy", detail: "Paneer set fresh daily from A2 milk; ghee made in small batches from cultured cream." },
  ],
  mediterranean: [
    { area: "Olive oil", detail: "First-cold-press EVOO from a Crete cooperative; tested for free fatty acids each batch." },
    { area: "Greens & vegetables", detail: "Hydroponic greens; tomatoes from a vine-ripened farm partner in Nashik." },
    { area: "Grains & legumes", detail: "Whole-grain durum, farro, and chickpeas — cooked al-dente, never canned." },
  ],
};

export function getSourcingForDish(dish: DishData): SourcingNote[] {
  return KITCHEN_SOURCING[dish.kitchen] ?? [];
}

