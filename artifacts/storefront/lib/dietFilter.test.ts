/**
 * Unit tests for storefront dietary filter chips and soft-auth gating (OB-4 / II.4).
 *
 * Run: node --test --import tsx ./lib/dietFilter.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { filterDishesByDiet, resolveInitialDietChip } from "./dietFilter";
import type { FetchImpl } from "./apiClient";

interface MockDish {
  id: number;
  name: string;
  isVeg: boolean;
}

const SAMPLE_DISHES: MockDish[] = [
  { id: 1, name: "Paneer Tikka Bowl", isVeg: true },
  { id: 2, name: "Grilled Chicken Quinoa", isVeg: false },
  { id: 3, name: "Dal Makhani & Rice", isVeg: true },
  { id: 4, name: "Salmon Power Greens", isVeg: false },
];

test("filterDishesByDiet: all leaves array intact, veg/non_veg filter accurately", () => {
  const all = filterDishesByDiet(SAMPLE_DISHES, "all");
  assert.equal(all.length, 4, "all preserves every dish");

  const veg = filterDishesByDiet(SAMPLE_DISHES, "veg");
  assert.deepEqual(veg.map((d) => d.id), [1, 3]);
  assert.ok(veg.every((d) => d.isVeg));

  const nonVeg = filterDishesByDiet(SAMPLE_DISHES, "non_veg");
  assert.deepEqual(nonVeg.map((d) => d.id), [2, 4]);
  assert.ok(nonVeg.every((d) => !d.isVeg));
});

test("filterDishesByDiet: composes cleanly with ranking order without losing relative ranking", () => {
  // Simulate system-inferred ranking where dish 3 was ranked above dish 1
  const rankedOrder: MockDish[] = [
    { id: 3, name: "Dal Makhani & Rice", isVeg: true },
    { id: 2, name: "Grilled Chicken Quinoa", isVeg: false },
    { id: 1, name: "Paneer Tikka Bowl", isVeg: true },
  ];

  const filtered = filterDishesByDiet(rankedOrder, "veg");
  assert.deepEqual(filtered.map((d) => d.id), [3, 1], "preserves exact relative rank order");
});

test("resolveInitialDietChip: ADDENDUM-7 gotcha — gates on getAuthUser before relying on soft-authed /preferences", async () => {
  // Anonymous user: auth endpoint returns null user, even if preferences returns 200 null/object
  let prefsCalled = false;
  const anonFetch = (async (url: string) => {
    if (url.includes("/auth/user")) {
      return { ok: true, text: async () => JSON.stringify({ user: null }) };
    }
    if (url.includes("/preferences")) {
      prefsCalled = true;
      return { ok: true, text: async () => JSON.stringify({ preferences: null }) };
    }
    return { ok: false };
  }) as unknown as FetchImpl;

  const chipAnon = await resolveInitialDietChip(anonFetch);
  assert.equal(chipAnon, "all");
  assert.equal(prefsCalled, false, "never invokes /preferences when getAuthUser returns null user");
});

test("resolveInitialDietChip: signed-in user with vegetarian dietaryStyle initializes to veg chip", async () => {
  const authedFetch = (async (url: string) => {
    if (url.includes("/auth/user")) {
      return { ok: true, text: async () => JSON.stringify({ user: { id: "u_123", email: "test@tanmatra.com" } }) };
    }
    if (url.includes("/preferences")) {
      return {
        ok: true,
        text: async () => JSON.stringify({ preferences: { userId: "u_123", dietaryStyle: "vegetarian" } }),
      };
    }
    return { ok: false };
  }) as unknown as FetchImpl;

  const chip = await resolveInitialDietChip(authedFetch);
  assert.equal(chip, "veg");
});
