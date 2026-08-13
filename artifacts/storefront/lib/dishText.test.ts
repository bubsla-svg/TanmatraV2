import test from "node:test";
import assert from "node:assert/strict";
import { ingredientName, ingredientSummary } from "./dishText";

test("strips a spaced en-dash quantity suffix", () => {
  assert.equal(ingredientName("Activated charcoal powder – ½ tsp"), "Activated charcoal powder");
});

test("keeps an unspaced hyphen inside a name — 'low-fat' must not split", () => {
  assert.equal(ingredientName("Almond milk / low-fat milk – 200 ml"), "Almond milk / low-fat milk");
});

test("splits on the FIRST separator only — a range in the quantity survives", () => {
  // "Ice cubes – 4–5": the quantity itself contains an en dash.
  assert.equal(ingredientName("Ice cubes – 4–5"), "Ice cubes");
});

test("an entry with no quantity is returned as-is", () => {
  assert.equal(ingredientName("Salt"), "Salt");
});

test("handles a spaced plain hyphen as well as an en dash", () => {
  assert.equal(ingredientName("Olive oil - 2 tbsp"), "Olive oil");
});

test("summary joins names with a middot", () => {
  const out = ingredientSummary(["Eggs – 2", "Tomato – 1", "Basil – 1 tbsp"]);
  assert.equal(out, "Eggs · Tomato · Basil");
});

test("summary caps the list and says how many remain — never truncates mid-word", () => {
  const many = ["A – 1", "B – 1", "C – 1", "D – 1", "E – 1", "F – 1", "G – 1"];
  assert.equal(ingredientSummary(many), "A · B · C · D · +3 more");
});

test("summary of an empty list is empty, not a stray separator", () => {
  assert.equal(ingredientSummary([]), "");
});

test("an ingredient containing its own commas stays ONE item", () => {
  // The exact catalog entry that made a comma-joined summary ambiguous:
  // comma-joined it reads as three ingredients and the overflow count then
  // disagrees with what the reader counts.
  const out = ingredientSummary([
    "Zucchini, bell peppers, broccoli – ½ cup (mixed, cut into strips)",
    "Parsley – 1 tbsp",
  ]);
  assert.equal(out, "Zucchini, bell peppers, broccoli · Parsley");
});

test("real catalog entry round-trip", () => {
  const real = [
    "Spaghetti pasta – 120 g (boiled al dente)",
    "Olive oil – 2 tbsp",
    "Garlic – 6–8 cloves (sliced)",
    "Dry red chili flakes – ½ tsp",
  ];
  assert.equal(
    ingredientSummary(real),
    "Spaghetti pasta · Olive oil · Garlic · Dry red chili flakes",
  );
});
