import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DISHES } from "@workspace/menu-catalog";
import {
  normalizeName,
  parseCuratedCsv,
  buildPlan,
  diffAgainstCurrent,
  cutReason,
  type CuratedRow,
  type CuratedAction,
  type MenuCandidate,
  type CurrentState,
} from "./menuEngineeringPlan";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = readFileSync(join(HERE, "../../data/curated_catalog.csv"), "utf8");

function row(action: CuratedAction, dish: string, priceRupees: number | null = null): CuratedRow {
  return { action, dish, category: "test", priceRupees, reason: `${action} ${dish}` };
}
function cur(partial: Partial<CurrentState> & { pricePaise: number }): CurrentState {
  return { isAvailable: true, unavailableUntil: null, unavailableReason: null, ...partial };
}

test("normalizeName: fold case/accents; keep variant qualifiers; drop serving-count noise", () => {
  assert.equal(normalizeName("Grilled Paneer With Sautéed Veggies"), normalizeName("Grilled Paneer with Sauteed Veggies"));
  assert.notEqual(normalizeName("Alfredo Pasta (Veg)"), normalizeName("Alfredo Pasta (Chicken)"));
  assert.notEqual(normalizeName("Omelette (2 Egg)"), normalizeName("Omelette"));
  assert.equal(normalizeName("Ragi Dates Eggless Brownie (1) Pc"), normalizeName("Ragi Dates Eggless Brownie"));
  assert.equal(normalizeName("Falafal Garden Salad"), normalizeName("Falafel Garden Salad"));
});

test("parseCuratedCsv: expected distribution; nothing skipped on the real sheet", () => {
  const { rows, skipped } = parseCuratedCsv(CSV);
  assert.equal(rows.length, 127);
  assert.equal(skipped.length, 0, "the shipped CSV must parse cleanly");
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.action, (by.get(r.action) ?? 0) + 1);
  assert.equal(by.get("KEEP-PUSH"), 34);
  assert.equal(by.get("CUT"), 56);
});

test("parseCuratedCsv: tolerant action casing/spacing; unknown action dropped + reported", () => {
  const { rows, skipped } = parseCuratedCsv(
    "action,dish,category,price,reason\nhold cost,Foo,Veg,200,x\nMAYBE,Bar,Veg,150,y",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "HOLD-COST");
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].rawAction, "MAYBE");
});

test("parseCuratedCsv: zero/negative/out-of-range price is ignored (never a Rs 0 write) + reported", () => {
  const { rows, skipped } = parseCuratedCsv(
    "action,dish,category,price,reason\nKEEP,Zero,Veg,0,a\nKEEP,Neg,Veg,-5,b\nKEEP,Huge,Veg,999999999,c\nKEEP,Ok,Veg,200,d",
  );
  assert.equal(rows.find((r) => r.dish === "Zero")?.priceRupees, null);
  assert.equal(rows.find((r) => r.dish === "Neg")?.priceRupees, null);
  assert.equal(rows.find((r) => r.dish === "Huge")?.priceRupees, null);
  assert.equal(rows.find((r) => r.dish === "Ok")?.priceRupees, 200);
  for (const d of ["Zero", "Neg", "Huge"]) assert.ok(skipped.some((s) => s.dish === d), `${d} price flagged`);
});

test("buildPlan on the real catalog: no ambiguity/conflict, unique slugs, heroes resolve, NO superset disable", () => {
  const { rows } = parseCuratedCsv(CSV);
  const candidates: MenuCandidate[] = DISHES.map((d) => ({ name: d.name, slug: d.slug }));
  const plan = buildPlan(rows, candidates);

  assert.equal(plan.ambiguous.length, 0);
  assert.equal(plan.conflicts.length, 0);
  const slugs = plan.changes.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, "no slug claimed twice");
  for (const c of plan.changes) assert.ok(c.matchKind === "exact" || c.matchKind === "override");

  // The former fuzzy-substring superset mis-matches must NOT be applied.
  const changed = new Set(plan.changes.map((c) => c.slug));
  for (const bad of [
    "peri-peri-paneer-fiesta-rice-bowl",
    "barbeque-paneer-fiesta-rice-bowl",
    "lemon-mint-ice-tea-smoothie",
  ]) {
    assert.ok(!changed.has(bad), `must not auto-apply to superset "${bad}"`);
  }

  for (const h of ["Barbeque Chicken Burrito Wrap", "Hummus Pita Classic", "Falafel Garden Salad"]) {
    assert.ok(
      plan.changes.some((c) => normalizeName(c.matchedName) === normalizeName(h)),
      `hero "${h}" must resolve`,
    );
  }
});

test("REGRESSION: a shorter CSV name never disables a longer, more-specific dish", () => {
  const plan = buildPlan(
    [row("CUT", "Grilled Chicken Rice Bowl")],
    [{ name: "Grilled Chicken Rice Bowl Deluxe", slug: "gcrb-deluxe" }],
  );
  assert.equal(plan.changes.length, 0, "superset must not be an applied change");
  assert.equal(plan.unmatched.length, 1);
  assert.deepEqual(plan.suggestions.map((s) => s.candidateSlug), ["gcrb-deluxe"], "reported as suggestion only");
});

test("REGRESSION: an under-specified CUT never auto-applies to a sibling once another row claims one", () => {
  const candidates: MenuCandidate[] = [
    { name: "Barbeque Paneer Rice Bowl", slug: "bpr" },
    { name: "Peri Peri Paneer Rice Bowl", slug: "ppr" },
  ];
  const plan = buildPlan([row("KEEP-PUSH", "Barbeque Paneer Rice Bowl"), row("CUT", "Paneer Rice Bowl")], candidates);
  assert.ok(!plan.changes.some((c) => c.cut), "the vague CUT must not disable a sibling");
  assert.ok(plan.unmatched.some((u) => u.dish === "Paneer Rice Bowl"));
});

test("REGRESSION: duplicate-normalizing rows (KEEP + CUT) don't disable the dish; conflict is reported", () => {
  const candidates: MenuCandidate[] = [{ name: "Tomato Basil Soup", slug: "tbs" }];
  const plan = buildPlan([row("KEEP-PUSH", "Tomato Basil Soup"), row("CUT", "Tomato Basil Soup")], candidates);
  assert.equal(plan.changes.length, 1, "only the first row wins the candidate");
  assert.equal(plan.changes[0].cut, false, "the KEEP-PUSH claim wins, not the CUT");
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].slug, "tbs");
  const diff = diffAgainstCurrent(plan.changes, new Map([["tbs", cur({ pricePaise: 22900 })]]));
  assert.equal(diff.toDisable.length, 0, "the dish must not be disabled");
});

test("REGRESSION: a temporary-86'd dish meant to be CUT is still corrected; exact CUT state is idempotent", () => {
  const plan = buildPlan([row("CUT", "Blue Berry Smoothie")], [{ name: "Blue Berry Smoothie", slug: "bbs" }]);
  const ch = plan.changes[0];

  // Temporary stockout with a future window + stale reason → must still act.
  const temp = new Map([
    ["bbs", cur({ isAvailable: false, pricePaise: 34900, unavailableUntil: new Date("2026-08-01"), unavailableReason: "out of stock" })],
  ]);
  assert.equal(diffAgainstCurrent(plan.changes, temp).toDisable.length, 1);

  // Already in the exact permanent-CUT target → no-op (idempotent).
  const done = new Map([
    ["bbs", cur({ isAvailable: false, pricePaise: 34900, unavailableUntil: null, unavailableReason: cutReason(ch.reason) })],
  ]);
  assert.equal(diffAgainstCurrent(plan.changes, done).toDisable.length, 0);
});

test("diffAgainstCurrent: minimal price sync; a CUT dish is never repriced", () => {
  const candidates: MenuCandidate[] = [
    { name: "Grilled Chicken Salad", slug: "gcs" },
    { name: "Blue Berry Smoothie", slug: "bbs" },
  ];
  const plan = buildPlan([row("KEEP", "Grilled Chicken Salad", 425), row("CUT", "Blue Berry Smoothie", 349)], candidates);
  const state = new Map([
    ["gcs", cur({ pricePaise: 40000 })], // 400 → target 425 : sync
    ["bbs", cur({ pricePaise: 30000 })], // CUT : never repriced even with a price
  ]);
  const { toDisable, priceSyncs } = diffAgainstCurrent(plan.changes, state);
  assert.equal(priceSyncs.length, 1);
  assert.equal(priceSyncs[0].change.slug, "gcs");
  assert.equal(priceSyncs[0].toPaise, 42500);
  assert.ok(!priceSyncs.some((p) => p.change.slug === "bbs"), "CUT dish must not be in price syncs");
  assert.equal(toDisable.length, 1);
});
