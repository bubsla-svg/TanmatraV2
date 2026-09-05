/**
 * Upsell candidate selection. Pure — no DOM, no network.
 * Run: node --test --import tsx ./lib/upsell.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { selectUpsellItems, upsellRailSpacerPx, UPSELL_MAX } from "./upsell";
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

// ---- rail placement under the order (cart drawer) ----------------------------
// A 393x667 phone: the drawer's scroll region gets ~308px; two order lines are
// ~158px; the horizontal rail plus its gap is ~134px, of which the header
// (gap + box padding + label) is ~50px.

test("rail placement: the rail fits under the order → no spacer", () => {
  assert.equal(upsellRailSpacerPx({ orderPx: 158, railPx: 134, capacityPx: 308, peekPx: 50 }), 0);
  // exactly fits
  assert.equal(upsellRailSpacerPx({ orderPx: 174, railPx: 134, capacityPx: 308, peekPx: 50 }), 0);
});

test("rail placement: the order already overflows → the rail is wholly below the fold, no spacer", () => {
  assert.equal(upsellRailSpacerPx({ orderPx: 400, railPx: 134, capacityPx: 308, peekPx: 50 }), 0);
  assert.equal(upsellRailSpacerPx({ orderPx: 308, railPx: 134, capacityPx: 308, peekPx: 50 }), 0);
});

test("rail placement: the fold would cut a card → padded down so the card row starts at the fold, header peeking", () => {
  // three lines leave 71px: the 50px header peeks, the cards start at the fold
  assert.equal(upsellRailSpacerPx({ orderPx: 237, railPx: 134, capacityPx: 308, peekPx: 50 }), 21);
  // one pixel short of fitting: 133 of room, header peeks, 83px of padding
  assert.equal(upsellRailSpacerPx({ orderPx: 175, railPx: 134, capacityPx: 308, peekPx: 50 }), 83);
  // exactly the header's worth of room: the label sits flush above the fold
  assert.equal(upsellRailSpacerPx({ orderPx: 258, railPx: 134, capacityPx: 308, peekPx: 50 }), 0);
  // fractional layout rounds up
  assert.equal(upsellRailSpacerPx({ orderPx: 236.4, railPx: 134, capacityPx: 308, peekPx: 50 }), 22);
});

test("rail placement: not even the header fits → the whole rail starts at the fold", () => {
  assert.equal(upsellRailSpacerPx({ orderPx: 280, railPx: 134, capacityPx: 308, peekPx: 50 }), 28);
  // no peek configured → the whole rail always starts at the fold
  assert.equal(upsellRailSpacerPx({ orderPx: 237, railPx: 134, capacityPx: 308 }), 71);
  // a nonsensical peek (taller than the rail) is ignored
  assert.equal(upsellRailSpacerPx({ orderPx: 237, railPx: 134, capacityPx: 308, peekPx: 200 }), 71);
});

test("rail placement: nothing to place (no rail, or an unmeasurable region) → no spacer", () => {
  assert.equal(upsellRailSpacerPx({ orderPx: 100, railPx: 0, capacityPx: 308, peekPx: 50 }), 0);
  assert.equal(upsellRailSpacerPx({ orderPx: 100, railPx: Number.NaN, capacityPx: 308 }), 0);
  assert.equal(upsellRailSpacerPx({ orderPx: 100, railPx: 134, capacityPx: Number.NaN }), 0);
});

test("rail placement invariant: the card row is always either wholly in view or wholly below the fold", () => {
  for (let orderPx = 0; orderPx <= 600; orderPx += 7) {
    for (const railPx of [90, 134, 170]) {
      for (const peekPx of [0, 50]) {
        for (const capacityPx of [220, 308, 493]) {
          const railTop = orderPx + upsellRailSpacerPx({ orderPx, railPx, capacityPx, peekPx });
          const rowTop = railTop + peekPx;
          assert.ok(
            railTop + railPx <= capacityPx || rowTop >= capacityPx,
            `order=${orderPx} rail=${railPx} peek=${peekPx} capacity=${capacityPx} → railTop=${railTop}`,
          );
          // and the order is never pushed: the spacer is never negative
          assert.ok(railTop >= orderPx);
        }
      }
    }
  }
});
