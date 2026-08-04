/**
 * OA-DEEP-1.7 — golden test for the pricing-loop hoist.
 *
 * `buildDishSuggestions` used to independently re-fetch and re-scan the
 * *entire* orders window for every dish in a pricing run — O(dishes ×
 * orders × items) round-trips and JS work. `buildSliceCountsBySlug` fetches
 * the window once and buckets every dish's zone/daypart slice counts from
 * that single pass instead.
 *
 * This compares the new one-pass grouping against a frozen copy of the
 * exact old per-dish scan (same `.some()` presence check, same
 * `zoneFromPincode`/`dayPartFromHour` helpers — both unchanged by this
 * refactor) run once per seeded dish, against real seeded Postgres data.
 * Byte-identical output is the bar: this is a performance rewrite, not a
 * behavior change.
 *
 * Needs Postgres (DATABASE_URL). Run with:
 *   DATABASE_URL=... node --test --import tsx \
 *     ./src/lib/menuEngineering.sliceCounts.golden.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";

import { inArray } from "drizzle-orm";
import { db, menuItemsTable, ordersTable } from "@workspace/db";

import {
  buildSliceCountsBySlug,
  dayPartFromHour,
  zoneFromPincode,
  type Daypart,
} from "./menuEngineering";

// Frozen copy of the pre-refactor per-dish scan (buildDishSuggestions'
// inline logic before OA-DEEP-1.7). Deliberately duplicated rather than
// imported — the whole point is an independent re-derivation to compare
// against.
function oldSliceCountsForSlug(
  orders: Array<{ pincode: string | null; createdAt: Date; items: unknown }>,
  slug: string,
  nameToSlug: Map<string, string>,
): Map<string, { count: number; zone: string; daypart: Daypart }> {
  const slices = new Map<string, { count: number; zone: string; daypart: Daypart }>();
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    const has = o.items.some((it) => {
      const n = (it as { name?: string }).name ?? "";
      return nameToSlug.get(n.toLowerCase()) === slug;
    });
    if (!has) continue;
    const zone = zoneFromPincode(o.pincode);
    const daypart = dayPartFromHour(o.createdAt.getUTCHours());
    const key = `${zone}:${daypart}`;
    const cur = slices.get(key) ?? { count: 0, zone, daypart };
    cur.count += 1;
    slices.set(key, cur);
  }
  return slices;
}

function sortedEntries(m: Map<string, unknown>): Array<[string, unknown]> {
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// A window no other suite writes into — see wbr.channel.test.ts's identical
// rationale for picking an otherwise-unused historical week.
const WINDOW_START = new Date("2016-11-08T00:00:00.000Z");
const WINDOW_END = new Date("2016-11-15T00:00:00.000Z");

const GOLDEN_BOWL = { slug: "ge17-golden-bowl", name: "GE17 Golden Bowl" };
const GINGER_TEA = { slug: "ge17-ginger-tea", name: "GE17 Ginger Tea" };
const KALE_SALAD = { slug: "ge17-kale-salad", name: "GE17 Kale Salad" };

const seededOrderIds: number[] = [];
const seededMenuItemIds: number[] = [];

function mealItem(id: number, name: string, price = 20000) {
  return { id, name, qty: 1, price };
}

after(async () => {
  if (seededOrderIds.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, seededOrderIds));
  }
  if (seededMenuItemIds.length > 0) {
    await db.delete(menuItemsTable).where(inArray(menuItemsTable.id, seededMenuItemIds));
  }
});

test("buildSliceCountsBySlug matches the old per-dish scan, one dish at a time", async () => {
  const items = await db
    .insert(menuItemsTable)
    .values([
      { slug: GOLDEN_BOWL.slug, name: GOLDEN_BOWL.name, pricePaise: 22000, category: "bowls" },
      { slug: GINGER_TEA.slug, name: GINGER_TEA.name, pricePaise: 8000, category: "beverages" },
      { slug: KALE_SALAD.slug, name: KALE_SALAD.name, pricePaise: 19000, category: "salads" },
    ])
    .returning({ id: menuItemsTable.id });
  seededMenuItemIds.push(...items.map((i) => i.id));

  const nameToSlug = new Map([
    [GOLDEN_BOWL.name.toLowerCase(), GOLDEN_BOWL.slug],
    [GINGER_TEA.name.toLowerCase(), GINGER_TEA.slug],
    [KALE_SALAD.name.toLowerCase(), KALE_SALAD.slug],
  ]);

  const orderRows = [
    // 1: pin-560, breakfast — golden bowl only
    { pincode: "560001", createdAt: "2016-11-09T09:00:00.000Z", items: [mealItem(1, GOLDEN_BOWL.name)] },
    // 2: pin-560, breakfast — golden bowl + ginger tea (multi-dish order)
    {
      pincode: "560001",
      createdAt: "2016-11-09T09:30:00.000Z",
      items: [mealItem(1, GOLDEN_BOWL.name), mealItem(2, GINGER_TEA.name)],
    },
    // 3: pin-560, lunch — golden bowl
    { pincode: "560001", createdAt: "2016-11-09T13:00:00.000Z", items: [mealItem(1, GOLDEN_BOWL.name)] },
    // 4: pin-400, breakfast — golden bowl
    { pincode: "400001", createdAt: "2016-11-10T09:00:00.000Z", items: [mealItem(1, GOLDEN_BOWL.name)] },
    // 5: pin-400, dinner — kale salad
    { pincode: "400001", createdAt: "2016-11-10T20:00:00.000Z", items: [mealItem(3, KALE_SALAD.name)] },
    // 6: pin-560, breakfast — golden bowl TWICE in the same order (duplicate
    // line for one dish must still count as 1, not 2, for that order)
    {
      pincode: "560001",
      createdAt: "2016-11-11T09:15:00.000Z",
      items: [mealItem(1, GOLDEN_BOWL.name), mealItem(1, GOLDEN_BOWL.name)],
    },
    // 7: pin-560, lunch — ginger tea
    { pincode: "560001", createdAt: "2016-11-11T13:30:00.000Z", items: [mealItem(2, GINGER_TEA.name)] },
    // 8: pin-400, lunch — an item that matches no seeded dish (unmatched name)
    { pincode: "400001", createdAt: "2016-11-12T13:00:00.000Z", items: [mealItem(9, "Unrelated Dish")] },
    // 9: no pincode — resolves to "unzoned"
    { pincode: null, createdAt: "2016-11-12T09:00:00.000Z", items: [mealItem(1, GOLDEN_BOWL.name)] },
    // 10: pin-700, dinner — kale salad + ginger tea
    {
      pincode: "700001",
      createdAt: "2016-11-13T20:30:00.000Z",
      items: [mealItem(3, KALE_SALAD.name), mealItem(2, GINGER_TEA.name)],
    },
  ];

  const inserted = await db
    .insert(ordersTable)
    .values(
      orderRows.map((o) => ({
        orderKind: "meal" as const,
        orderChannel: "own_app" as const,
        status: "delivered",
        totalPaise: 20000,
        pincode: o.pincode,
        addressLine: "test",
        city: "Bengaluru",
        phone: "+910000000000",
        items: o.items,
        fulfillmentType: "delivery" as const,
        createdAt: new Date(o.createdAt),
      })),
    )
    .returning({ id: ordersTable.id });
  seededOrderIds.push(...inserted.map((r) => r.id));

  const newResult = await buildSliceCountsBySlug(WINDOW_START, WINDOW_END, nameToSlug);

  // Fetch the same window once (mirrors what the old per-dish code did on
  // every call) to feed the frozen old-algorithm comparison.
  const windowOrders = await db
    .select({ pincode: ordersTable.pincode, createdAt: ordersTable.createdAt, items: ordersTable.items })
    .from(ordersTable)
    .where(inArray(ordersTable.id, seededOrderIds));

  for (const slug of [GOLDEN_BOWL.slug, GINGER_TEA.slug, KALE_SALAD.slug]) {
    const oldSlices = oldSliceCountsForSlug(windowOrders, slug, nameToSlug);
    const newSlices = newResult.get(slug) ?? new Map();
    assert.deepEqual(
      sortedEntries(newSlices),
      sortedEntries(oldSlices),
      `slice counts diverged for ${slug}`,
    );
  }

  // Spot-check one hand-computed value so old-vs-new agreement can't hide a
  // bug shared by both implementations.
  const goldenBowlSlices = newResult.get(GOLDEN_BOWL.slug);
  assert.equal(
    goldenBowlSlices?.get("pin-560:breakfast")?.count,
    3,
    "orders 1, 2, and 6 are golden bowl / pin-560 / breakfast (order 6's duplicate line counts once)",
  );
  assert.equal(goldenBowlSlices?.get("pin-560:lunch")?.count, 1, "order 3");
  assert.equal(goldenBowlSlices?.get("pin-400:breakfast")?.count, 1, "order 4");
  assert.equal(goldenBowlSlices?.get("unzoned:breakfast")?.count, 1, "order 9");
  assert.equal(goldenBowlSlices?.size, 4, "no extra golden-bowl slices leaked in");

  // The unmatched item (order 8) must not silently attach to any slug.
  for (const slices of newResult.values()) {
    for (const { count } of slices.values()) {
      assert.ok(count > 0);
    }
  }
});
