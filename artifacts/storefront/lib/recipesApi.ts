/**
 * Recipes content client (Wave C of the route-parity port). The api-server
 * exposes PUBLIC, read-only endpoints — `GET /api/recipes` (list, optional
 * goal/diet/maxTime/q filters) and `GET /api/recipes/:slug` (detail) — both
 * returning the identical full `Recipe` row. Server components call these
 * directly via API_BASE_URL; a cold/unreachable API degrades to an empty list
 * (or null) so a page renders its empty/not-found state instead of throwing.
 *
 * `getRecipeOrReason` is the honest counterpart to `getRecipe`: it
 * distinguishes "no such slug" from "couldn't reach the api" instead of
 * collapsing both to `null` (see the doc comment on the function itself).
 * `fetchRecipesList` is the CLIENT-side (browser, `NEXT_PUBLIC_API_BASE`)
 * counterpart to `getRecipes`, used by `RecipesBrowser`'s `useQuery` so a
 * fetch failure there surfaces as `isError`, not a silent `[]`.
 */
import { apiGet } from "./apiClient";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

/** Injectable fetch so the wire contract is testable without a network. */
export type FetchImpl = typeof fetch;

export interface Recipe {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string;
  image: string | null;
  authorName: string;
  authorRole: string;
  goal: string;
  diet: string;
  timeMinutes: number;
  calories: number | null;
  proteinGrams: number | null;
  tags: string[];
  ingredients: string[];
  steps: string[];
  publishedAt: string;
}

const REVALIDATE = { next: { revalidate: 3600 } } as RequestInit;

/** All published recipes (server owns ordering/limit). [] on any failure. */
export async function getRecipes(fetchImpl: FetchImpl = fetch): Promise<Recipe[]> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/recipes`, REVALIDATE);
    if (!res.ok) throw new Error(`recipes ${res.status}`);
    const data = (await res.json()) as { recipes?: Recipe[] };
    return data.recipes ?? [];
  } catch {
    return [];
  }
}

/** One recipe by slug. null on 404 or any failure. */
export async function getRecipe(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<Recipe | null> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/recipes/${encodeURIComponent(slug)}`, REVALIDATE);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`recipe ${res.status}`);
    const data = (await res.json()) as { recipe?: Recipe };
    return data.recipe ?? null;
  } catch {
    return null;
  }
}

export type RecipeLookup =
  | { ok: true; recipe: Recipe }
  | { ok: false; reason: "not_found" | "unavailable" };

/**
 * Like `getRecipe`, but distinguishes "no such slug" from "couldn't reach the
 * api" — `getRecipe` collapses both to `null`, which made `/recipes/[slug]`
 * 404 a real recipe during a transient API outage.
 */
export async function getRecipeOrReason(
  slug: string,
  fetchImpl: FetchImpl = fetch,
): Promise<RecipeLookup> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/recipes/${encodeURIComponent(slug)}`, REVALIDATE);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { recipe?: Recipe };
    return data.recipe ? { ok: true, recipe: data.recipe } : { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Client-side (browser) recipe list fetch through the same-origin `/api`
 * proxy — the `getRecipes` above runs server-side against `API_BASE_URL`,
 * which isn't reachable from the browser. Used by `RecipesBrowser`'s
 * `useQuery` (key `["recipes", "list"]`): unlike `getRecipes`, this throws on
 * failure so the query's `isError` reflects a real outage instead of an empty
 * list that reads as "no recipes match those filters."
 */
export async function fetchRecipesList(fetchImpl?: FetchImpl): Promise<Recipe[]> {
  const data = await apiGet<{ recipes?: Recipe[] }>("/recipes", fetchImpl);
  return data.recipes ?? [];
}
