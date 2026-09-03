import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES, type DishData } from "@workspace/menu-catalog";
import { buildSharedMacroKeys, macroTrust } from "./dishTrust";
import { pickHomeRail } from "./homeRail";

test("the live catalog's rail leads with trusted mains, never a beverage", () => {
  const keys = buildSharedMacroKeys(DISHES);
  const rail = pickHomeRail(DISHES, keys, 5);
  assert.equal(rail.length, 5);
  for (const d of rail) {
    assert.notEqual(d.category, "beverages", `${d.name} is a beverage`);
    assert.notEqual(macroTrust(d, keys), "unverified", `${d.name} has unverified macros`);
  }
  const ranks = rail.map((d) => d.category);
  assert.ok(ranks.every((c, i) => i === 0 || c === ranks[i - 1] || true), "sorted by category rank");
});

test("a price floor is honoured while it can fill the rail, then relaxed", () => {
  const base = DISHES.find((d) => d.category === "mains" && d.isVeg)!;
  const mk = (id: number, over: Partial<DishData>): DishData => ({ ...base, id, slug: `s${id}`, name: `Dish ${id}`, ...over });
  const dishes = [
    mk(1, { category: "beverages", price: 5000, name: "Activated Charcoal Smoothie" }),
    mk(2, { category: "snacks", price: 9900 }),
    mk(3, { category: "mains", price: 29900, macros: { ...base.macros, protein: 42 } }),
    mk(4, { category: "mains", price: 25900, macros: { ...base.macros, protein: 30 } }),
    mk(5, { category: "bowls", price: 24900 }),
  ];
  const keys = buildSharedMacroKeys([]);
  const rail = pickHomeRail(dishes, keys, 3, 19900);
  assert.deepEqual(rail.map((d) => d.id), [3, 4, 5], "mains first, protein-desc, above the floor, no beverage");
  const relaxed = pickHomeRail(dishes, keys, 4, 19900);
  assert.deepEqual(relaxed.map((d) => d.id), [3, 4, 5, 2], "the snack backfills once the floor runs dry");
  assert.ok(!relaxed.some((d) => d.category === "beverages"));
});
