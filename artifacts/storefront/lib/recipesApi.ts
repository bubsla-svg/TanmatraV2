/**
 * Recipes content client (Wave C of the route-parity port). The api-server
 * exposes PUBLIC, read-only endpoints — `GET /api/recipes` (list, optional
 * goal/diet/maxTime/q filters) and `GET /api/recipes/:slug` (detail) — both
 * returning the identical full `Recipe` row. Server components call these
 * directly via API_BASE_URL; a cold/unreachable API degrades to an empty list
 * (or null) so a page renders its empty/not-found state instead of throwing.
 */
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
