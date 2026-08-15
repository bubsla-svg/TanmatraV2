/**
 * TNM-MENU-01 M-4 — §6 option-group builder tests (pure).
 *
 * Pins the §6 money ladder: every priced modifier lands exactly on the
 * manual's paise totals against the payload base prices, every required
 * group carries a default (so shipping data ahead of the M-5 chooser UI can
 * never block a checkout), and the builder is deterministic (idempotency of
 * the plan engine's structural compare depends on it).
 *
 * Run with:
 *   node --test --import tsx ./src/lib/menuOptionGroups.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOptionGroups } from "./menuOptionGroups";

const WOK_NOODLE_FLAGS = [
  "protein-choice-egg-179-chicken-199-paneer-199",
  "needs-macros",
  "needs-cogs",
];
const WOK_RICE_FLAGS = ["protein-choice-egg-179-chicken-199", "schezwan-sauce-option"];
const PASTA_FLAGS = ["base-choice", "protein-choice-chicken-220", "millet-confirm-N1", "chicken-239"];

test("§6 money ladder: wok proteins hit 17900/19900 against the 14900 base", () => {
  const [protein] = buildOptionGroups(WOK_NOODLE_FLAGS);
  assert.ok(protein);
  const base = 14_900;
  const by = new Map(protein.options.map((o) => [o.name, o.priceModifier]));
  assert.equal(base + by.get("Veg")!, 14_900);
  assert.equal(base + by.get("Egg")!, 17_900);
  assert.equal(base + by.get("Chicken")!, 19_900);
  assert.equal(base + by.get("Paneer")!, 19_900);
});

test("the rice row's protein group omits Paneer (noodles only, §6)", () => {
  const groups = buildOptionGroups(WOK_RICE_FLAGS);
  const protein = groups.find((g) => g.groupName === "Choose your protein");
  assert.ok(protein);
  assert.ok(!protein.options.some((o) => o.name === "Paneer"));
  assert.ok(groups.some((g) => g.groupName === "Schezwan style"));
});

test("§6 money ladder: pasta chicken totals 23900 and soup NV totals 11900", () => {
  const pasta = buildOptionGroups(PASTA_FLAGS);
  const proteinAdd = pasta.find((g) => g.groupName === "Add protein");
  assert.equal(19_900 + proteinAdd!.options[0]!.priceModifier, 23_900);
  assert.ok(pasta.find((g) => g.groupName === "Pasta base")!.required);

  const soup = buildOptionGroups(["nv-variant-120", "nv-variant-119", "band-B1"]);
  const nv = soup.find((g) => g.groupName === "Make it chicken");
  assert.equal(7_900 + nv!.options[0]!.priceModifier, 11_900);
});

test("burrito upgrade is +2000 and omelette add-ons are +3000 each, optional", () => {
  const groups = buildOptionGroups(["burrito-upgrade", "sauce-chooser", "addon-group"]);
  const burrito = groups.find((g) => g.groupName === "Make it a burrito")!;
  assert.equal(burrito.options[0]!.priceModifier, 2000);
  assert.ok(!burrito.required);
  const addons = groups.find((g) => g.groupName === "Omelette add-ons")!;
  assert.equal(addons.type, "multiple");
  assert.ok(addons.options.every((o) => o.priceModifier === 3000));
});

test("every required group carries a ₹0-consistent default option", () => {
  const all = [
    ...buildOptionGroups(["sauce-chooser"]),
    ...buildOptionGroups(WOK_NOODLE_FLAGS),
    ...buildOptionGroups(PASTA_FLAGS),
    ...buildOptionGroups(["two-variant-one-line"]),
  ];
  for (const g of all.filter((g) => g.required)) {
    const def = g.options.find((o) => o.default);
    assert.ok(def, `required group "${g.groupName}" must carry a default`);
    assert.equal(def.priceModifier, 0, "a silent default must never add money");
  }
});

test("the builder is deterministic (byte-stable for the engine's structural compare)", () => {
  const a = JSON.stringify(buildOptionGroups(["sauce-chooser", "burrito-upgrade"]));
  const b = JSON.stringify(buildOptionGroups(["sauce-chooser", "burrito-upgrade"]));
  assert.equal(a, b);
});

test("flagless rows get no groups", () => {
  assert.deepEqual(buildOptionGroups(["fix-first", "riser"]), []);
});
