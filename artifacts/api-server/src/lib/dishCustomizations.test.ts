/**
 * Unit tests for resolveCustomizations — the only place a customisation's
 * priceModifier is read and applied (see dishCustomizations.ts header).
 *
 * Run with:
 *   node --test --import tsx ./src/lib/dishCustomizations.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCustomizations } from "./dishCustomizations";
import type { DishCustomGroup } from "@workspace/menu-catalog";

const BREAD: DishCustomGroup = {
  groupName: "Choose Bread Type",
  type: "single",
  options: [
    { name: "Brown Bread", priceModifier: 0, default: true },
    { name: "Multigrain Bread", priceModifier: 1500 },
  ],
};

const BOOSTS: DishCustomGroup = {
  groupName: "Add Boosts",
  type: "multiple",
  options: [
    { name: "Extra protein scoop", priceModifier: 6000 },
    { name: "Chia seeds", priceModifier: 2000 },
    { name: "Included topping", priceModifier: 0, default: true },
  ],
};

test("no selections → zero modifier, no labels (matches an unset legacy group)", () => {
  const result = resolveCustomizations([BREAD], undefined);
  assert.deepEqual(result, { ok: true, modifierPaise: 0, labels: [] });
});

test("empty selections array → same as undefined", () => {
  const result = resolveCustomizations([BREAD], []);
  assert.deepEqual(result, { ok: true, modifierPaise: 0, labels: [] });
});

test("single group, non-default option → priced and labelled", () => {
  const result = resolveCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Multigrain Bread"] },
  ]);
  assert.deepEqual(result, { ok: true, modifierPaise: 1500, labels: ["Multigrain Bread"] });
});

test("single group, default option selected → priced (zero) but NOT labelled", () => {
  // Mirrors the legacy PDP's collectCustomizations(): defaults are real
  // selections for pricing purposes but are not "what the customer changed".
  const result = resolveCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Brown Bread"] },
  ]);
  assert.deepEqual(result, { ok: true, modifierPaise: 0, labels: [] });
});

test("single group with >1 option names → rejected", () => {
  const result = resolveCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Brown Bread", "Multigrain Bread"] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /accepts one selection/);
});

test("multiple group sums every selected option, skips defaults in labels", () => {
  const result = resolveCustomizations([BOOSTS], [
    {
      groupName: "Add Boosts",
      optionNames: ["Extra protein scoop", "Chia seeds", "Included topping"],
    },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.modifierPaise, 8000);
    assert.deepEqual(result.labels.sort(), ["Chia seeds", "Extra protein scoop"]);
  }
});

test("unknown group name → rejected, fails closed", () => {
  const result = resolveCustomizations([BREAD], [
    { groupName: "Choose Something Else", optionNames: [] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /unknown customisation group/);
});

test("unknown option name within a real group → rejected, fails closed", () => {
  const result = resolveCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Sourdough"] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /unknown option/);
});

test("duplicate option name within one group's selection → rejected", () => {
  const result = resolveCustomizations([BOOSTS], [
    { groupName: "Add Boosts", optionNames: ["Chia seeds", "Chia seeds"] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /duplicate option/);
});

test("duplicate group in the selections array → rejected", () => {
  const result = resolveCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: [] },
    { groupName: "Choose Bread Type", optionNames: ["Multigrain Bread"] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /duplicate customisation group/);
});

test("two independent groups both priced and summed", () => {
  const result = resolveCustomizations([BREAD, BOOSTS], [
    { groupName: "Choose Bread Type", optionNames: ["Multigrain Bread"] },
    { groupName: "Add Boosts", optionNames: ["Extra protein scoop"] },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.modifierPaise, 1500 + 6000);
    assert.deepEqual(result.labels, ["Multigrain Bread", "Extra protein scoop"]);
  }
});

test("negative priceModifier (a discount option) subtracts, not floors at zero", () => {
  const portion: DishCustomGroup = {
    groupName: "Choose Portion size",
    type: "single",
    options: [
      { name: "100 Gm Chicken", priceModifier: 0, default: true },
      { name: "50gm Chicken", priceModifier: -10000 },
    ],
  };
  const result = resolveCustomizations([portion], [
    { groupName: "Choose Portion size", optionNames: ["50gm Chicken"] },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.modifierPaise, -10000);
});

test("dish with no customisation groups at all + a selection → unknown group, fails closed", () => {
  const result = resolveCustomizations([], [
    { groupName: "Anything", optionNames: ["X"] },
  ]);
  assert.equal(result.ok, false);
});
