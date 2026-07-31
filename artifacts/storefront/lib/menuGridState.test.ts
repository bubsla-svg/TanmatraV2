/**
 * OA-DEEP-1.8 — the order/visibility wiring behind the /menu RSC-boundary
 * fix. `computeMenuGridState` is pure and DB/network-free: no DOM, no
 * fetch. It decides which pre-rendered dish rows MenuGrid shows and in what
 * order — the rows themselves are built server-side (app/menu/page.tsx) and
 * never touched here.
 * Run: node --test --import tsx ./lib/menuGridState.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import { computeMenuGridState, capVisibleIds, type RankedDish } from "./menuGridState";
import type { DishFit } from "./menuFit";

const BASE = DISHES[0]!;
function dish(overrides: Partial<DishData>): DishData {
  return { ...BASE, ...overrides } as DishData;
}

const NEUTRAL_FIT: DishFit = { band: "neutral" };

test("no ranking: order is undefined and every dish is visible under the 'all' chip", () => {
  const dishes = [dish({ id: 1, isVeg: true }), dish({ id: 2, isVeg: false })];
  const state = computeMenuGridState(dishes, null, "all");
  assert.equal(state.order, undefined);
  assert.equal(state.fits, undefined);
  assert.deepEqual([...state.visibleIds].sort(), [1, 2]);
});

test("ranking assigns each dish id its position in the ranked list", () => {
  const a = dish({ id: 1, isVeg: true });
  const b = dish({ id: 2, isVeg: true });
  const c = dish({ id: 3, isVeg: true });
  // Ranked best-first: c, a, b — order values must reflect THAT sequence,
  // not the original dishes array order.
  const ranked: RankedDish[] = [
    { dish: c, fit: { band: "high" } },
    { dish: a, fit: NEUTRAL_FIT },
    { dish: b, fit: { band: "conflict", conflictLabel: "Contains Peanuts" } },
  ];
  const state = computeMenuGridState([a, b, c], ranked, "all");
  assert.equal(state.order?.get(3), 0);
  assert.equal(state.order?.get(1), 1);
  assert.equal(state.order?.get(2), 2);
  assert.equal(state.fits?.get(2)?.conflictLabel, "Contains Peanuts");
});

test("diet chip filters visibleIds regardless of ranking", () => {
  const veg = dish({ id: 1, isVeg: true });
  const nonVeg = dish({ id: 2, isVeg: false });
  const state = computeMenuGridState([veg, nonVeg], null, "veg");
  assert.deepEqual([...state.visibleIds], [1]);
});

test("a filtered-out dish keeps its order entry — CSS order needs no compaction", () => {
  const veg = dish({ id: 1, isVeg: true });
  const nonVeg = dish({ id: 2, isVeg: false });
  const ranked: RankedDish[] = [
    { dish: nonVeg, fit: { band: "high" } }, // ranked best, but will be diet-filtered out
    { dish: veg, fit: NEUTRAL_FIT },
  ];
  const state = computeMenuGridState([veg, nonVeg], ranked, "veg");
  // Still visible only for the veg dish...
  assert.deepEqual([...state.visibleIds], [1]);
  // ...but the order map still carries both — MenuGrid applies `hidden`
  // independently of `order`, and a hidden flex item consuming an order
  // slot has no visible effect on the ones that remain.
  assert.equal(state.order?.get(2), 0);
  assert.equal(state.order?.get(1), 1);
});

test("capVisibleIds: no ranking caps in raw row order", () => {
  const rowIds = [1, 2, 3, 4, 5];
  const visibleIds = new Set(rowIds);
  const capped = capVisibleIds(rowIds, undefined, visibleIds, 3);
  assert.deepEqual([...capped].sort((a, b) => a - b), [1, 2, 3]);
  assert.equal(capped.size, 3);
});

test("capVisibleIds: ranked dishes cap in ranked order, not raw row order", () => {
  const rowIds = [1, 2, 3, 4, 5];
  const visibleIds = new Set(rowIds);
  // Best-first ranking: 5, 3, 1, 4, 2 — "first 2" must be {5, 3}, not {1, 2}.
  const order = new Map([[5, 0], [3, 1], [1, 2], [4, 3], [2, 4]]);
  const capped = capVisibleIds(rowIds, order, visibleIds, 2);
  assert.deepEqual([...capped].sort((a, b) => a - b), [3, 5]);
});

test("capVisibleIds: diet-filtered-out ids never count against the limit", () => {
  const rowIds = [1, 2, 3, 4, 5];
  const visibleIds = new Set([1, 3, 5]); // veg-only filter, say
  const capped = capVisibleIds(rowIds, undefined, visibleIds, 2);
  assert.deepEqual([...capped].sort((a, b) => a - b), [1, 3]);
});

test("capVisibleIds: a limit at or beyond the visible count returns every visible id", () => {
  const rowIds = [1, 2, 3];
  const visibleIds = new Set(rowIds);
  const capped = capVisibleIds(rowIds, undefined, visibleIds, 20);
  assert.deepEqual([...capped].sort((a, b) => a - b), [1, 2, 3]);
});
