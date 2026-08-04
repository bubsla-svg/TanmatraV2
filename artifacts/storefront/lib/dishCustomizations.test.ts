import assert from "node:assert/strict";
import { test } from "node:test";
import { previewCustomizations, defaultOptionName } from "./dishCustomizations";
import type { DishCustomGroup } from "@workspace/menu-catalog";

const BREAD: DishCustomGroup = {
  groupName: "Choose Bread Type",
  type: "single",
  options: [
    { name: "Brown Bread", priceModifier: 0, default: true },
    { name: "Multigrain Bread", priceModifier: 1500 },
  ],
};

test("no selections → zero modifier, no labels", () => {
  assert.deepEqual(previewCustomizations([BREAD], []), { modifierPaise: 0, labels: [] });
});

test("non-default option → priced and labelled", () => {
  const preview = previewCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Multigrain Bread"] },
  ]);
  assert.deepEqual(preview, { modifierPaise: 1500, labels: ["Multigrain Bread"] });
});

test("default option → priced at zero, not labelled", () => {
  const preview = previewCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Brown Bread"] },
  ]);
  assert.deepEqual(preview, { modifierPaise: 0, labels: [] });
});

test("unrecognised group is skipped rather than thrown — this is a preview, not the gate", () => {
  const preview = previewCustomizations([BREAD], [
    { groupName: "Nonexistent", optionNames: ["X"] },
  ]);
  assert.deepEqual(preview, { modifierPaise: 0, labels: [] });
});

test("unrecognised option within a real group is skipped, not thrown", () => {
  const preview = previewCustomizations([BREAD], [
    { groupName: "Choose Bread Type", optionNames: ["Sourdough"] },
  ]);
  assert.deepEqual(preview, { modifierPaise: 0, labels: [] });
});

test("defaultOptionName returns the option marked default:true", () => {
  assert.equal(defaultOptionName(BREAD), "Brown Bread");
});

test("defaultOptionName returns undefined when no option is marked default", () => {
  const noDefault: DishCustomGroup = { groupName: "X", type: "single", options: [{ name: "A", priceModifier: 0 }] };
  assert.equal(defaultOptionName(noDefault), undefined);
});
