/**
 * Upsell candidate selection. Pure — no DOM, no network.
 * Run: node --test --import tsx ./lib/upsell.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { selectUpsellItems, UPSELL_MAX } from "./upsell";
import type { MarketplaceItem } from "./marketplaceApi";
import type { CartLine } from "./cartStore";

function item(over: Partial<MarketplaceItem>): MarketplaceItem {
  return {
    id: 1,
    slug: "cold-pressed-mustard-oil",
    name: "Cold-pressed mustard oil",
    description: "Single-origin, small batch",
    longDescription: "",
    category: "oils",
    pricePaise: 42900,
    weightLabel: "500ml",
    supplierName: null,
    image: null,
    badges: [],
    rdVerified: false,
    stockQty: 12,
    ...over,
  };
}

function line(over: Partial<CartLine>): CartLine {
  return {
    dishId: 1,
    kind: "marketplace",
    slug: "cold-pressed-mustard-oil",
    name: "Cold-pressed mustard oil",
    pricePaise: 42900,
    qty: 1,
    ...over,
  };
}

const CATALOG = [
  item({ id: 1, slug: "a" }),
  item({ id: 2, slug: "b" }),
  item({ id: 3, slug: "c" }),
  item({ id: 4, slug: "d" }),
];

test("offers at most UPSELL_MAX items, in catalog order", () => {
  const picked = selectUpsellItems(CATALOG, []);
  assert.equal(picked.length, UPSELL_MAX);
  assert.deepEqual(picked.map((i) => i.id), [1, 2, 3]);
});

test("an item already in the cart is not re-offered", () => {
  const picked = selectUpsellItems(CATALOG, [line({ dishId: 2, slug: "b" })]);
  assert.deepEqual(picked.map((i) => i.id), [1, 3, 4]);
});

/**
 * THE ID-COLLISION BUG. Cart line ids are per-kind: a DISH with id 2 says
 * nothing about MARKETPLACE item 2. The old filter compared bare ids across
 * kinds and would have silently suppressed a perfectly offerable item.
 */
test("a DISH line with a colliding id does not suppress the marketplace item", () => {
  const picked = selectUpsellItems(CATALOG, [line({ dishId: 2, kind: "dish", slug: "paneer-bowl" })]);
  assert.deepEqual(picked.map((i) => i.id), [1, 2, 3]);
});

test("out-of-stock items are never offered", () => {
  const catalog = [item({ id: 1 }), item({ id: 2, stockQty: 0 }), item({ id: 3 })];
  const picked = selectUpsellItems(catalog, []);
  assert.deepEqual(picked.map((i) => i.id), [1, 3]);
});

test("an empty catalog yields an empty rail — never an invented one", () => {
  assert.deepEqual(selectUpsellItems([], []), []);
});
