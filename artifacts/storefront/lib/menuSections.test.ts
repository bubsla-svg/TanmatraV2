import test from "node:test";
import assert from "node:assert/strict";
import { groupBySection, MENU_SECTIONS, NO_PERSONALIZATION_BOOST_SECTION } from "./menuSections";

test("groups items into fixed sections, in §5 order, omitting empty ones", () => {
  const items = [
    { id: 1, sectionOrder: 3 },
    { id: 2, sectionOrder: 1 },
    { id: 3, sectionOrder: 1 },
  ];
  const grouped = groupBySection(items, (i) => i.sectionOrder);
  assert.deepEqual(
    grouped.map((s) => s.order),
    [1, 3],
  );
  assert.deepEqual(grouped[0]!.items.map((i) => i.id), [2, 3]);
  assert.equal(grouped[0]!.name, "High-Protein Meals");
});

test("items with no sectionOrder land in a trailing 'More dishes' bucket", () => {
  const items = [{ id: 1, sectionOrder: undefined as number | undefined }, { id: 2, sectionOrder: 1 }];
  const grouped = groupBySection(items, (i) => i.sectionOrder);
  assert.equal(grouped.at(-1)!.name, "More dishes");
  assert.deepEqual(grouped.at(-1)!.items.map((i) => i.id), [1]);
});

test("preserves input order within a section", () => {
  const items = [
    { id: 5, sectionOrder: 2 },
    { id: 1, sectionOrder: 2 },
    { id: 9, sectionOrder: 2 },
  ];
  const grouped = groupBySection(items, (i) => i.sectionOrder);
  assert.deepEqual(grouped[0]!.items.map((i) => i.id), [5, 1, 9]);
});

test("all 13 §5 sections are present and in fixed order", () => {
  assert.equal(MENU_SECTIONS.length, 13);
  assert.deepEqual(
    MENU_SECTIONS.map((s) => s.order),
    Array.from({ length: 13 }, (_, i) => i + 1),
  );
  assert.equal(MENU_SECTIONS.at(-1)!.name, "Off the Wok");
});

test("section 13 is the personalization-boost exclusion", () => {
  assert.equal(NO_PERSONALIZATION_BOOST_SECTION, 13);
  assert.equal(MENU_SECTIONS.find((s) => s.order === 13)!.name, "Off the Wok");
});

test("empty input yields no sections", () => {
  assert.deepEqual(groupBySection([], () => 1), []);
});
