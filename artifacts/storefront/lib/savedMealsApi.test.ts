import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getMySavedMeals, saveMealToVault, removeMealFromVault } from "./savedMealsApi";

const mockMeal = {
  id: 1,
  userId: "u_123",
  dishSlug: "hp-paneer",
  dishName: "High Protein Paneer Bowl",
  notes: "Extra nuts",
  tags: ["fav"],
  createdAt: "2026-07-25T19:00:00Z",
  updatedAt: "2026-07-25T19:00:00Z",
};

afterEach(() => {
  mock.restoreAll();
});

test("getMySavedMeals calls GET /api/saved-meals", async () => {
  mock.method(globalThis, "fetch", async (url: string | URL) => {
    assert.equal(url.toString().endsWith("/api/saved-meals"), true);
    return new Response(JSON.stringify([mockMeal]), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const res = await getMySavedMeals();
  assert.equal(res[0]?.dishSlug, "hp-paneer");
});

test("saveMealToVault calls POST /api/saved-meals", async () => {
  mock.method(globalThis, "fetch", async (url: string | URL, opts: RequestInit) => {
    assert.equal(url.toString().endsWith("/api/saved-meals"), true);
    assert.equal(opts.method, "POST");
    return new Response(JSON.stringify(mockMeal), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const res = await saveMealToVault({ dishSlug: "hp-paneer", dishName: "High Protein Paneer Bowl" });
  assert.equal(res.dishName, "High Protein Paneer Bowl");
});

test("removeMealFromVault calls DELETE /api/saved-meals/:slug", async () => {
  mock.method(globalThis, "fetch", async (url: string | URL, opts: RequestInit) => {
    assert.equal(url.toString().endsWith("/api/saved-meals/hp-paneer"), true);
    assert.equal(opts.method, "DELETE");
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const res = await removeMealFromVault("hp-paneer");
  assert.equal(res.success, true);
});
