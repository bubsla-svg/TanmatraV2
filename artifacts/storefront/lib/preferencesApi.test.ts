/**
 * Food-preferences client's wire contract (injected fetch, no network). Locks
 * method/path/credentials/body against routes/preferences.ts.
 * Run: node --test --import tsx ./lib/preferencesApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { getPreferences, savePreferences } from "./preferencesApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      credentials: init.credentials as string | undefined,
      body: init.body,
    });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

const PREFS = {
  userId: "u1",
  allergens: ["peanuts"],
  dislikedIngredients: [],
  medicalConditions: [],
  cuisines: ["south indian"],
  spiceLevel: "medium",
  dietaryStyle: "vegetarian",
  goal: "lose_weight",
  activityLevel: "moderate",
  calorieTarget: null,
  proteinTargetGrams: null,
  carbsTargetGrams: null,
  fatTargetGrams: null,
  hba1cPct: null,
  pcosHistory: null,
  heightCm: null,
  weightKg: null,
  quizCompletedAt: null,
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
};

test("getPreferences: GET /api/preferences, cookie-authed", async () => {
  const calls: Call[] = [];
  const res = await getPreferences(fakeFetch(calls, () => ({ status: 200, body: { preferences: PREFS } })));
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/preferences$/);
  assert.equal(c.credentials, "include");
  assert.equal(res.preferences?.dietaryStyle, "vegetarian");
});

test("getPreferences: signed-out returns { preferences: null } at 200 (no throw)", async () => {
  const res = await getPreferences(fakeFetch([], () => ({ status: 200, body: { preferences: null } })));
  assert.equal(res.preferences, null);
});

test("savePreferences: PATCH /api/preferences sends the patch verbatim", async () => {
  const calls: Call[] = [];
  const patch = { dietaryStyle: "vegan" as const, allergens: ["soy"], cuisines: ["thai"] };
  const res = await savePreferences(
    patch,
    fakeFetch(calls, () => ({ status: 200, body: { preferences: { ...PREFS, dietaryStyle: "vegan" } } })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "PATCH");
  assert.match(c.url, /\/api\/preferences$/);
  assert.equal(c.credentials, "include");
  assert.deepEqual(JSON.parse(String(c.body)), patch);
  assert.equal(res.preferences.dietaryStyle, "vegan");
});

test("savePreferences: 401 surfaces as a typed ApiError (so the UI can re-gate on sign-in)", async () => {
  await assert.rejects(
    savePreferences({ goal: "maintain" }, fakeFetch([], () => ({ status: 401, body: { error: "unauthorized" } }))),
    (e) => e instanceof ApiError && e.status === 401,
  );
});

test("savePreferences: 400 invalid payload surfaces as a typed ApiError", async () => {
  await assert.rejects(
    savePreferences({ spiceLevel: "medium" }, fakeFetch([], () => ({ status: 400, body: { error: "invalid payload" } }))),
    (e) => e instanceof ApiError && e.status === 400 && /invalid payload/.test((e as Error).message),
  );
});
