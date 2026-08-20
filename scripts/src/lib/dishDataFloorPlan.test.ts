// The data-floor engine decides which dishes leave the customer menu, so the
// tests that matter are the ones pinning what it must NOT draft. Over-drafting
// empties the storefront a fortnight before launch; under-drafting leaves a
// dish with no ingredient list inside an allergen filter.
//   cd scripts && node --test --import tsx ./src/lib/dishDataFloorPlan.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildPlan,
  evaluateFloors,
  hasNoIngredientData,
  normalizeIngredient,
  renderPlanMarkdown,
  verifyPostState,
  type DbDishRow,
} from "./dishDataFloorPlan";

const row = (over: Partial<DbDishRow> = {}): DbDishRow => ({
  slug: "test-dish",
  name: "Test Dish",
  reviewState: "reviewed",
  archived: false,
  ingredients: ["Paneer – 100 g", "Olive oil – 1 tsp"],
  ...over,
});

// ── Floor 1: ingredients ────────────────────────────────────────────────────

test("the production placeholder is caught", () => {
  // The literal value on 17 live dishes per the 2026-08-18 macro truth report.
  assert.equal(hasNoIngredientData(["fresh ingredients"]), true);
});

test("placeholder matching is case- and whitespace-insensitive", () => {
  assert.equal(hasNoIngredientData(["  Fresh   Ingredients "]), true);
  assert.equal(normalizeIngredient("  Fresh   Ingredients "), "fresh ingredients");
});

test("an empty or null list is no data", () => {
  assert.equal(hasNoIngredientData([]), true);
  assert.equal(hasNoIngredientData(null), true);
  assert.equal(hasNoIngredientData(["", "   "]), true);
});

// This is the test that keeps the engine honest. A substring rule on
// "fresh ingredients" would match every one of these and draft dishes whose
// ingredients are written out in full.
test("a real ingredient that CONTAINS a placeholder word is not a placeholder", () => {
  assert.equal(hasNoIngredientData(["Fresh coriander"]), false);
  assert.equal(hasNoIngredientData(["Fresh cream – 20 ml"]), false);
  assert.equal(hasNoIngredientData(["Ingredients sourced daily: paneer, peas"]), false);
  assert.equal(hasNoIngredientData(["Natal plum"]), false); // contains "na"
  assert.equal(hasNoIngredientData(["Tbsp butter"]), false); // contains "tbd"? no — guards the set
});

test("one real entry beside a placeholder passes — thin is not blank", () => {
  // ["fresh ingredients", "Paneer"] can still be filtered on dairy, so the
  // allergen case this engine exists for does not apply. Drafting it would be
  // a content-quality judgement, which this engine deliberately never makes.
  assert.equal(hasNoIngredientData(["fresh ingredients", "Paneer – 100 g"]), false);
});

// ── The floor that was REMOVED, pinned so it is not casually re-added ───────

/**
 * A NO_MACROS floor shipped in the first version of this engine and was wrong
 * twice over; the 2026-08-20 production plan run flagged ~100 of 112 dishes.
 * These two tests are the evidence, executable, so a re-add has to confront it.
 *
 * The unit tests that accompanied the broken floor all passed — they asserted
 * against fixtures written with the same wrong field name as the code. That is
 * why this pair reads the REAL schema and the REAL resolver off disk instead
 * of restating my belief about them.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("the DB macro key is `kcal`, not `calories` — bug 1, from the schema itself", () => {
  const schema = readFileSync(
    resolve(repoRoot, "lib/db/src/schema/menuItems.ts"),
    "utf8",
  );
  const macrosBlock = schema.slice(schema.indexOf('macros: jsonb("macros")'));
  assert.match(
    macrosBlock.slice(0, 400),
    /kcal:\s*number/,
    "menu_items.macros is typed with `kcal`; a floor reading `.calories` sees undefined on every populated row",
  );
});

test("a null macros column is NOT a blank card — bug 2, from the resolver itself", () => {
  const resolver = readFileSync(
    resolve(repoRoot, "artifacts/api-server/src/lib/menuResolver.ts"),
    "utf8",
  );
  // Matched rows fall back to the static catalog's curated macros...
  assert.match(
    resolver,
    /:\s*stat\.macros/,
    "the merge path falls back to stat.macros, so a null column still renders numbers",
  );
  // ...and unmatched rows get zeros that macroTrust already grades unverified.
  assert.match(
    resolver,
    /\{\s*calories:\s*0,\s*protein:\s*0/,
    "the DB-only path substitutes an all-zero block that macroTrust already gates",
  );
});

// ── Candidate selection ─────────────────────────────────────────────────────

test("only reviewed, unarchived rows are candidates", () => {
  const plan = buildPlan([
    row({ slug: "live-bad", ingredients: ["fresh ingredients"] }),
    row({ slug: "already-draft", reviewState: "pending_review", ingredients: null }),
    row({ slug: "blocked", reviewState: "blocked", ingredients: null }),
    row({ slug: "cut", archived: true, ingredients: null }),
    row({ slug: "live-good" }),
  ]);

  assert.deepEqual(plan.actions.map((a) => a.slug), ["live-bad"]);
  assert.deepEqual(plan.reports.alreadyDrafted, ["already-draft", "blocked"]);
  assert.deepEqual(plan.reports.archived, ["cut"]);
  assert.deepEqual(plan.reports.passing, ["live-good"]);
});

test("an archived row is reported as archived even when it is also below the floor", () => {
  // Order matters: archived is checked first, so an M-3 CUT keeps its own
  // reason rather than being re-labelled as unfinished content.
  const plan = buildPlan([row({ slug: "cut", archived: true, ingredients: null })]);
  assert.deepEqual(plan.reports.archived, ["cut"]);
  assert.equal(plan.actions.length, 0);
});

// ── Plan shape ──────────────────────────────────────────────────────────────

test("a failing row reports its floor and a note naming the reason", () => {
  const plan = buildPlan([row({ slug: "empty", ingredients: ["fresh ingredients"] })]);
  assert.deepEqual(plan.actions[0]!.failures, ["NO_INGREDIENTS"]);
  assert.match(plan.actions[0]!.note, /no ingredient data/);
  // The note reaches an rd_note column, so it must name the allergen stake
  // rather than just the field — that is what a reader acts on.
  assert.match(plan.actions[0]!.note, /allergen/);
});

test("actions and reports are slug-sorted, so a re-run diffs clean", () => {
  const plan = buildPlan([
    row({ slug: "zucchini", ingredients: null }),
    row({ slug: "apple", ingredients: null }),
    row({ slug: "mango", ingredients: null }),
  ]);
  assert.deepEqual(plan.actions.map((a) => a.slug), ["apple", "mango", "zucchini"]);
});

test("the note is stable for a given failure set — it reaches an audit row", () => {
  const a = buildPlan([row({ slug: "a", ingredients: null })]).actions[0]!.note;
  const b = buildPlan([row({ slug: "b", ingredients: [] })]).actions[0]!.note;
  assert.equal(a, b, "same failure set must produce the identical note");
});

test("counts add up, per-floor tallies keyed off the FLOORS table", () => {
  const plan = buildPlan([
    row({ slug: "no-ing", ingredients: ["fresh ingredients"] }),
    row({ slug: "empty-list", ingredients: [] }),
    row({ slug: "fine" }),
    row({ slug: "cut", archived: true }),
  ]);
  assert.equal(plan.counts["rows"], 4);
  assert.equal(plan.counts["draft"], 2);
  assert.equal(plan.counts["passing"], 1);
  assert.equal(plan.counts["archived"], 1);
  // Keyed off the FLOORS table, not hand-listed.
  assert.equal(plan.counts["NO_INGREDIENTS"], 2);
});

// ── Blockers ────────────────────────────────────────────────────────────────

test("a duplicate slug blocks the plan rather than being deduped", () => {
  // menu_items.slug is unique, so a repeat means the caller's query is wrong.
  // Picking one silently would apply a plan built from rows nobody reviewed.
  const plan = buildPlan([row({ slug: "dup" }), row({ slug: "dup" })]);
  assert.equal(plan.blockers.length, 1);
  assert.match(plan.blockers[0]!, /duplicate slug/);
});

test("an empty input is a valid plan with nothing to do, not a blocker", () => {
  const plan = buildPlan([]);
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.counts["rows"], 0);
});

// ── Convergence ─────────────────────────────────────────────────────────────

test("verifyPostState is empty once the drafted rows are pending_review", () => {
  const before = [
    row({ slug: "bad", ingredients: ["fresh ingredients"] }),
    row({ slug: "good" }),
  ];
  assert.deepEqual(verifyPostState(before), ["bad"]);

  const after = [
    row({ slug: "bad", ingredients: ["fresh ingredients"], reviewState: "pending_review" }),
    row({ slug: "good" }),
  ];
  assert.deepEqual(verifyPostState(after), []);
});

test("verifyPostState ignores archived rows below the floor", () => {
  assert.deepEqual(verifyPostState([row({ slug: "cut", archived: true, ingredients: null })]), []);
});

test("the plan is idempotent — re-planning the applied state yields no actions", () => {
  const applied = [
    row({ slug: "bad", ingredients: ["fresh ingredients"], reviewState: "pending_review" }),
    row({ slug: "good" }),
  ];
  assert.equal(buildPlan(applied).actions.length, 0);
});

// ── Rendering ───────────────────────────────────────────────────────────────

test("the markdown names every drafted dish and says nothing when there is nothing", () => {
  const empty = renderPlanMarkdown(buildPlan([row({ slug: "fine" })]));
  assert.match(empty, /No dish is below the floor/);

  const md = renderPlanMarkdown(
    buildPlan([row({ slug: "aam-panna", name: "Aam Panna", ingredients: ["fresh ingredients"] })]),
  );
  assert.match(md, /aam-panna/);
  assert.match(md, /Aam Panna/);
  assert.match(md, /NO_INGREDIENTS/);
});

test("blockers are rendered before anything a reader might act on", () => {
  const md = renderPlanMarkdown(buildPlan([row({ slug: "dup" }), row({ slug: "dup" })]));
  assert.match(md, /## Blockers/);
});

// ── The failure this engine exists to prevent ───────────────────────────────

test("evaluateFloors passes a fully-populated dish untouched", () => {
  // The regression that would matter most: a rule that drafts good dishes.
  assert.deepEqual(evaluateFloors(row()), []);
  assert.deepEqual(
    evaluateFloors(row({ ingredients: ["Chicken breast – 120 g"] })),
    [],
  );
});
