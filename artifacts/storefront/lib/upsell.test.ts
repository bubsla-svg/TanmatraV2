/**
 * Upsell candidate selection. Pure — no DOM, no network.
 * Run: node --test --import tsx ./lib/upsell.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  cheapestDishLinePaise,
  isUpsellFood,
  selectUpsell,
  selectUpsellDishes,
  selectUpsellItems,
  upsellRailSpacerPx,
  UPSELL_MAX,
  type UpsellDish,
} from "./upsell";
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

// ---- food add-ons (T7) -------------------------------------------------------
// Prices in paise. The café catalog of 2026-09-17: coolers are `beverages`
// (₹179), nachos/wings are `snacks` (₹119–₹310); a dessert has no category of
// its own and is known only by its §5 section (11).

function dish(over: Partial<UpsellDish> & { id: number }): UpsellDish {
  return {
    slug: `dish-${over.id}`,
    name: `Dish ${over.id}`,
    price: 17900,
    category: "beverages",
    isAvailable: true,
    ...over,
  };
}

function meal(dishId: number, pricePaise: number): CartLine {
  return line({ dishId, kind: "dish", slug: `meal-${dishId}`, name: `Meal ${dishId}`, pricePaise });
}

const FOOD_CATALOG: UpsellDish[] = [
  dish({ id: 10, name: "Mama Rose Pasta", category: "pasta", price: 34900 }),
  dish({ id: 11, name: "Chicken Burger", category: "wraps", price: 24900 }),
  dish({ id: 12, name: "Guava Chilli Cooler", category: "beverages", price: 17900 }),
  dish({ id: 13, name: "Classic Nachos", category: "snacks", price: 11900 }),
  dish({ id: 14, name: "Chia Pudding", category: "breakfast", sectionOrder: 11, price: 14900 }),
  dish({ id: 15, name: "Loaded Chicken Nachos", category: "snacks", price: 25900 }),
  dish({ id: 16, name: "Sold-out Fizz", category: "beverages", price: 6900, isAvailable: false }),
  dish({ id: 17, name: "Watermelon Juice", category: "beverages", price: 6900 }),
  dish({ id: 18, name: "Antioxidant Detox", category: "beverages", price: 17000 }),
];

test("food: only desserts, coolers/beverages and snacks qualify — never a main, wrap or pasta", () => {
  assert.equal(isUpsellFood(dish({ id: 1, category: "beverages" })), true);
  assert.equal(isUpsellFood(dish({ id: 1, category: "snacks" })), true);
  // a dessert is known by its §5 section, not a category
  assert.equal(isUpsellFood(dish({ id: 1, category: "breakfast", sectionOrder: 11 })), true);
  assert.equal(isUpsellFood(dish({ id: 1, category: "breakfast", sectionOrder: 10 })), true);
  assert.equal(isUpsellFood(dish({ id: 1, category: "breakfast", sectionOrder: 12 })), true);
  for (const category of ["pasta", "wraps", "bowls", "mains", "salads", "soups", "breakfast"] as const) {
    assert.equal(isUpsellFood(dish({ id: 1, category })), false, category);
    assert.equal(isUpsellFood(dish({ id: 1, category, sectionOrder: 1 })), false, `${category} s1`);
  }
});

test("food: a dish cart gets food only, each strictly cheaper than the cheapest meal, cheapest first", () => {
  const picked = selectUpsellDishes(FOOD_CATALOG, [meal(10, 34900), meal(11, 24900)]);
  // ceiling is ₹249: the ₹259 nachos are out; the ₹179 cooler, ₹149 dessert,
  // ₹119 nachos, ₹69 juice and ₹170 detox are in — capped at 3, cheapest first
  assert.deepEqual(picked.map((d) => d.id), [17, 13, 14]);
  assert.ok(picked.every((d) => d.price < 24900));
});

test("food: the ceiling is the cheapest meal's UNIT price, never a line total or a marketplace line", () => {
  // ₹69 juice at qty 3 is still a ₹69 meal — nothing in the catalog is cheaper
  assert.deepEqual(selectUpsellDishes(FOOD_CATALOG, [{ ...meal(17, 6900), qty: 3 }]), []);
  // a ₹429 pantry jar does not raise the ceiling above the ₹119 meal
  const picked = selectUpsellDishes(FOOD_CATALOG, [meal(13, 11900), line({ dishId: 1, pricePaise: 42900 })]);
  assert.deepEqual(picked.map((d) => d.id), [17]);
  assert.equal(cheapestDishLinePaise([meal(13, 11900), line({ dishId: 1, pricePaise: 42900 })]), 11900);
  assert.equal(cheapestDishLinePaise([line({ dishId: 1, pricePaise: 42900 })]), null);
});

test("food: equal price is not cheaper — a ₹179 cooler is not offered against a ₹179 meal", () => {
  const picked = selectUpsellDishes(FOOD_CATALOG, [meal(99, 17900)]);
  assert.ok(!picked.some((d) => d.price === 17900));
  assert.deepEqual(picked.map((d) => d.id), [17, 13, 14]);
});

test("food: a dish already in the cart is not re-offered; a marketplace line with the same id does not suppress it", () => {
  // the ₹69 juice (17) is in the cart → the next three cheapest
  assert.deepEqual(
    selectUpsellDishes(FOOD_CATALOG, [meal(10, 34900), meal(17, 6900)]).map((d) => d.id),
    [],
  );
  assert.deepEqual(
    selectUpsellDishes(FOOD_CATALOG, [meal(10, 34900), meal(13, 11900)]).map((d) => d.id),
    [17],
  );
  // marketplace item #17 in the cart says nothing about dish #17
  assert.deepEqual(
    selectUpsellDishes(FOOD_CATALOG, [meal(11, 24900), line({ dishId: 17 })]).map((d) => d.id),
    [17, 13, 14],
  );
});

test("food: unavailable dishes are never offered", () => {
  const picked = selectUpsellDishes(FOOD_CATALOG, [meal(10, 34900)]);
  assert.ok(!picked.some((d) => d.id === 16));
});

test("food: capped at UPSELL_MAX by default, and at an explicit max", () => {
  const cart = [meal(10, 34900)];
  assert.equal(selectUpsellDishes(FOOD_CATALOG, cart).length, UPSELL_MAX);
  assert.deepEqual(selectUpsellDishes(FOOD_CATALOG, cart, 5).map((d) => d.id), [17, 13, 14, 18, 12]);
  assert.deepEqual(selectUpsellDishes(FOOD_CATALOG, cart, 1).map((d) => d.id), [17]);
});

test("food: deterministic — price ties break by name, then id", () => {
  const catalog = [
    dish({ id: 3, name: "Zest", price: 9900 }),
    dish({ id: 2, name: "Apple", price: 9900 }),
    dish({ id: 1, name: "Apple", price: 9900 }),
  ];
  assert.deepEqual(selectUpsellDishes(catalog, [meal(50, 20000)]).map((d) => d.id), [1, 2, 3]);
});

test("routing: a dish-only cart gets the food rail", () => {
  const sel = selectUpsell({ dishes: FOOD_CATALOG, marketplaceItems: CATALOG, cartLines: [meal(10, 34900)] });
  assert.equal(sel.kind, "dish");
  assert.deepEqual(sel.items.map((d) => d.id), [17, 13, 14]);
});

test("routing: a mixed cart (dish + pantry) follows the food rules, not the pantry ones", () => {
  const sel = selectUpsell({
    dishes: FOOD_CATALOG,
    marketplaceItems: CATALOG,
    cartLines: [line({ dishId: 1, slug: "a" }), meal(11, 24900)],
  });
  assert.equal(sel.kind, "dish");
  assert.deepEqual(sel.items.map((d) => d.id), [17, 13, 14]);
});

test("routing: a pantry-only cart keeps today's pantry recommendations", () => {
  const sel = selectUpsell({
    dishes: FOOD_CATALOG,
    marketplaceItems: CATALOG,
    cartLines: [line({ dishId: 2, slug: "b" })],
  });
  assert.equal(sel.kind, "marketplace");
  assert.deepEqual(sel.items.map((i) => i.id), [1, 3, 4]);
});

test("routing: an empty cart gets no rail of either kind", () => {
  const sel = selectUpsell({ dishes: FOOD_CATALOG, marketplaceItems: CATALOG, cartLines: [] });
  assert.equal(sel.kind, "none");
  assert.deepEqual(sel.items, []);
});

test("routing: a catalog that has not loaded (or failed) yields an empty rail, never a crash", () => {
  assert.deepEqual(selectUpsell({ dishes: undefined, marketplaceItems: undefined, cartLines: [meal(10, 34900)] }).items, []);
  assert.deepEqual(selectUpsell({ dishes: undefined, marketplaceItems: undefined, cartLines: [line({ dishId: 2 })] }).items, []);
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
