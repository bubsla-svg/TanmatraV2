/**
 * Recipes client wire contract (injected fetch, no network). Verifies the
 * endpoint URLs + response unwrapping ({recipes}/{recipe}), the 404→null path,
 * and the empty-on-error resilience the pages rely on.
 * Run: node --test --import tsx ./lib/recipesApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getRecipes, getRecipe, getRecipeOrReason, fetchRecipesList, type Recipe } from "./recipesApi";

const SAMPLE: Recipe = {
  id: 1, slug: "high-protein-paneer-bowl", title: "Paneer Bowl", summary: "s", body: "b",
  image: null, authorName: "Dr. Anika Rao", authorRole: "Lead RD", goal: "gain_muscle",
  diet: "vegetarian", timeMinutes: 15, calories: 480, proteinGrams: 30, tags: ["high-protein"],
  ingredients: ["200g paneer"], steps: ["Sear paneer"], publishedAt: "2026-07-01T00:00:00.000Z",
};

interface Call { url: string }
function jsonFetch(calls: Call[], body: unknown, status = 200): typeof fetch {
  return (async (url: unknown) => {
    calls.push({ url: String(url) });
    // `.text()` is included alongside `.json()` — `fetchRecipesList` goes
    // through `apiClient`'s `apiGet`, which reads the body via `.text()`.
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
}

test("getRecipes: GETs /api/recipes and unwraps {recipes}", async () => {
  const calls: Call[] = [];
  const out = await getRecipes(jsonFetch(calls, { recipes: [SAMPLE] }));
  assert.match(calls[0]!.url, /\/api\/recipes$/);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.slug, "high-protein-paneer-bowl");
});

test("getRecipe: GETs /api/recipes/:slug and unwraps {recipe}", async () => {
  const calls: Call[] = [];
  const out = await getRecipe("high-protein-paneer-bowl", jsonFetch(calls, { recipe: SAMPLE }));
  assert.match(calls[0]!.url, /\/api\/recipes\/high-protein-paneer-bowl$/);
  assert.equal(out?.title, "Paneer Bowl");
});

test("getRecipe: 404 resolves to null", async () => {
  const out = await getRecipe("nope", jsonFetch([], { error: "not found" }, 404));
  assert.equal(out, null);
});

test("getRecipes: a failed fetch resolves to [] (page renders empty, not error)", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  assert.deepEqual(await getRecipes(failing), []);
});

test("getRecipeOrReason: ok:true with the recipe on a normal hit", async () => {
  const calls: Call[] = [];
  const out = await getRecipeOrReason("high-protein-paneer-bowl", jsonFetch(calls, { recipe: SAMPLE }));
  assert.match(calls[0]!.url, /\/api\/recipes\/high-protein-paneer-bowl$/);
  assert.deepEqual(out, { ok: true, recipe: SAMPLE });
});

test("getRecipeOrReason: 404 is reason:not_found (not a collapsed falsy value)", async () => {
  const out = await getRecipeOrReason("nope", jsonFetch([], { error: "not found" }, 404));
  assert.deepEqual(out, { ok: false, reason: "not_found" });
});

test("getRecipeOrReason: a 500 is reason:unavailable, distinct from not_found", async () => {
  const out = await getRecipeOrReason("high-protein-paneer-bowl", jsonFetch([], { error: "boom" }, 500));
  assert.deepEqual(out, { ok: false, reason: "unavailable" });
});

test("getRecipeOrReason: a thrown/network failure is reason:unavailable, not not_found", async () => {
  const failing = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const out = await getRecipeOrReason("high-protein-paneer-bowl", failing);
  assert.deepEqual(out, { ok: false, reason: "unavailable" });
});

test("fetchRecipesList: GETs /api/recipes (cookie-authed client path) and unwraps {recipes}", async () => {
  const calls: Call[] = [];
  const out = await fetchRecipesList(jsonFetch(calls, { recipes: [SAMPLE] }));
  assert.match(calls[0]!.url, /\/api\/recipes$/);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.slug, "high-protein-paneer-bowl");
});

test("fetchRecipesList: a non-2xx rejects (so useQuery's isError reflects the outage)", async () => {
  await assert.rejects(fetchRecipesList(jsonFetch([], { error: "boom" }, 500)));
});
