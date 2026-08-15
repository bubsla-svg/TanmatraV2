import test from "node:test";
import assert from "node:assert/strict";
import { dishCardSummary, ingredientName, ingredientSummary } from "./dishText";

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

// ── dishCardSummary: the line that has to tell two dishes apart ────────────

test("authored taste copy always wins over derived text", () => {
  assert.equal(
    dishCardSummary({
      tasteDescription: "Silky, garlicky, with a slow chilli heat.",
      description: "Spaghetti pasta, Olive oil, Garlic, and more.",
      ingredients: ["Spaghetti pasta – 120 g"],
    }),
    "Silky, garlicky, with a slow chilli heat.",
  );
});

test("siblings in a dish family no longer read identically", () => {
  // The exact catalog rows that shipped three indistinguishable cards: the
  // first three ingredients are the shared base, so the catalog's own
  // `description` was byte-identical across all three.
  const base = ["Spaghetti pasta – 120 g (boiled al dente)", "Olive oil – 2 tbsp", "Garlic – 6–8 cloves (sliced)"];
  const veg = dishCardSummary({ ingredients: [...base, "Dry red chili flakes – ½ tsp", "Zucchini, bell peppers, broccoli – ½ cup"] });
  const chicken = dishCardSummary({ ingredients: [...base, "Chili flakes – ½ tsp", "Grilled chicken breast – 100 g"] });
  const prawns = dishCardSummary({ ingredients: [...base, "Chili flakes – ½ tsp", "Prawns – 100 g"] });

  assert.notEqual(veg, chicken);
  assert.notEqual(chicken, prawns);
  // The differentiating ingredient reaches the card in every case.
  assert.ok(veg.includes("Zucchini, bell peppers, broccoli"));
  assert.ok(chicken.includes("Grilled chicken breast"));
  assert.ok(prawns.includes("Prawns"));
});

test("pantry staples drop out, but only on a whole-name match", () => {
  const out = dishCardSummary({
    ingredients: ["Salt – 1 tsp", "Garlic bread – 2 slices", "Butter – 10 g", "Paneer – 150 g"],
  });
  assert.equal(out, "Garlic bread · Paneer", "salt/butter dropped; 'Garlic bread' is not 'Garlic'");
});

test("a dish with only staples falls back to the catalog description, never blank", () => {
  assert.equal(
    dishCardSummary({ description: "House dal, slow-cooked.", ingredients: ["Salt – 1 tsp", "Water – 200 ml"] }),
    "House dal, slow-cooked.",
  );
  assert.equal(dishCardSummary({ ingredients: [] }), "");
});

// ── Stub guard (M-5 §3.4, defect S-3 / finding F8) ────────────────────────

test("the 'fresh ingredients' placeholder never becomes the card line", () => {
  // The exact production shape: 18 live dishes look like this.
  const stub = {
    ingredients: ["fresh ingredients"],
    description: "Aam Panna - prepared fresh daily.",
    longDescription:
      "A traditional cooling summer drink made from boiled raw green mangoes, sweetened naturally with organic jaggery.",
  };
  const line = dishCardSummary(stub);
  assert.ok(!line.toLowerCase().includes("fresh ingredients"), `leaked stub text: ${line}`);
  assert.match(line, /raw green mangoes/, "should fall through to the real prose");
});

test("stub guard prefers real prose over the templated description", () => {
  assert.equal(
    dishCardSummary({
      ingredients: ["fresh ingredients"],
      description: "Garlic Bread - prepared fresh daily.",
      longDescription: "Sourdough baked with roasted garlic butter and herbs.",
    }),
    "Sourdough baked with roasted garlic butter and herbs.",
  );
});

test("stub guard falls back to description when no prose exists", () => {
  assert.equal(
    dishCardSummary({
      ingredients: ["fresh ingredients"],
      description: "Garlic Bread - prepared fresh daily.",
    }),
    "Garlic Bread - prepared fresh daily.",
  );
});

test("an ingredient-list longDescription is NOT used as prose", () => {
  // The curated seed catalog's longDescription carries quantities; printing
  // it here would re-create the duplication this module exists to remove.
  const line = dishCardSummary({
    ingredients: ["fresh ingredients"],
    description: "Fallback copy.",
    longDescription: "Spaghetti pasta – 120 g (boiled al dente) · Olive oil – 2 tbsp",
  });
  assert.equal(line, "Fallback copy.");
});

test("a real ingredient list is still preferred over longDescription", () => {
  assert.equal(
    dishCardSummary({
      ingredients: ["Grilled chicken – 120 g", "Brown rice – 150 g"],
      longDescription: "Some prose that must not win.",
    }),
    "Grilled chicken · Brown rice",
  );
});
