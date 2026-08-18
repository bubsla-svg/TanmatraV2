// The data-floor engine decides which dishes leave the customer menu, so the
// tests that matter are the ones pinning what it must NOT draft. Over-drafting
// empties the storefront a fortnight before launch; under-drafting leaves a
// dish with no ingredient list inside an allergen filter.
//   cd scripts && node --test --import tsx ./src/lib/dishDataFloorPlan.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlan,
  evaluateFloors,
  hasNoCalorieData,
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
  macros: { calories: 320 },
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

// ── Floor 2: calories ───────────────────────────────────────────────────────

test("an explicit zero is data, not absence", () => {
  // Diet Coke and the zero-calorie mojito are honestly zero. Failing these
  // would draft the dishes whose macros are most obviously correct.
  assert.equal(hasNoCalorieData({ calories: 0 }), false);
});

test("absence in each of its forms is caught", () => {
  assert.equal(hasNoCalorieData(null), true);
  assert.equal(hasNoCalorieData({}), true);
  assert.equal(hasNoCalorieData({ calories: null }), true);
  assert.equal(hasNoCalorieData({ calories: undefined }), true);
});

test("a non-finite or non-numeric calorie value is absence, never a number", () => {
  assert.equal(hasNoCalorieData({ calories: NaN }), true);
  assert.equal(hasNoCalorieData({ calories: Infinity }), true);
  // jsonb can hold a string where a number belongs if a writer was sloppy.
  assert.equal(
    hasNoCalorieData({ calories: "320" } as unknown as { calories?: number | null }),
    true,
  );
});

test("a negative calorie count is a number, and not this engine's problem", () => {
  // Nonsense, but it is a stated value: the floor is absence, not validity.
  // Drafting on -5 would make this engine a data validator, and every future
  // validity rule would then arrive as a silent menu removal.
  assert.equal(hasNoCalorieData({ calories: -5 }), false);
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
  const plan = buildPlan([row({ slug: "cut", archived: true, ingredients: null, macros: null })]);
  assert.deepEqual(plan.reports.archived, ["cut"]);
  assert.equal(plan.actions.length, 0);
});

// ── Plan shape ──────────────────────────────────────────────────────────────

test("a row failing both floors reports both, in declaration order", () => {
  const plan = buildPlan([
    row({ slug: "empty", ingredients: ["fresh ingredients"], macros: null }),
  ]);
  assert.deepEqual(plan.actions[0]!.failures, ["NO_INGREDIENTS", "NO_MACROS"]);
  assert.match(plan.actions[0]!.note, /no ingredient data/);
  assert.match(plan.actions[0]!.note, /no calorie figure/);
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

test("counts add up and separate the two floors", () => {
  const plan = buildPlan([
    row({ slug: "no-ing", ingredients: ["fresh ingredients"] }),
    row({ slug: "no-kcal", macros: {} }),
    row({ slug: "both", ingredients: [], macros: null }),
    row({ slug: "fine" }),
    row({ slug: "cut", archived: true }),
  ]);
  assert.equal(plan.counts["rows"], 5);
  assert.equal(plan.counts["draft"], 3);
  assert.equal(plan.counts["passing"], 1);
  assert.equal(plan.counts["archived"], 1);
  assert.equal(plan.counts["noIngredients"], 2);
  assert.equal(plan.counts["noMacros"], 2);
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
    evaluateFloors(row({ ingredients: ["Chicken breast – 120 g"], macros: { calories: 0 } })),
    [],
  );
});
