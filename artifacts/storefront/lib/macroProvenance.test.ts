import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { DISHES } from "@workspace/menu-catalog";
import { formatMacroLine, MACROS_PENDING_LABEL } from "./format";

/**
 * Law 8 — a dish always shows its numbers, and never shows numbers it does
 * not have.
 *
 * menu-catalog derives `macrosProvisional` for a dish whose seed macros were a
 * duplicated placeholder bucket AND for which the ingredient calculator
 * produced no high-confidence estimate. Its doc comment has said "the UI gates
 * them behind a 'being verified' state" since it was introduced — and no
 * surface did. Every consumer read `macrosEstimated` alone, so a placeholder
 * bucket rendered as a confident figure.
 *
 * On a clinical-nutrition product that is the worst available way to be wrong.
 * A missing number is an inconvenience; a fabricated one can be planned around
 * by someone managing diabetes or renal load.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(HERE, "..", "components");

test("a provisional dish shows the pending label instead of numbers", () => {
  const line = formatMacroLine({ calories: 240, protein: 4 }, false, true);
  assert.equal(line, MACROS_PENDING_LABEL);
  assert.doesNotMatch(line, /\d/, "no figure may survive into the provisional state");
});

test("provisional outranks estimated", () => {
  // An estimate is a real calculation worth qualifying with ≈. A placeholder
  // is not a value, so the ≈ treatment would overstate it.
  assert.equal(formatMacroLine({ calories: 240, protein: 4 }, true, true), MACROS_PENDING_LABEL);
});

test("non-provisional dishes are unaffected", () => {
  assert.match(formatMacroLine({ calories: 686, protein: 42 }, false, false), /686/);
  assert.match(formatMacroLine({ calories: 686, protein: 42 }, true), /≈686/);
  // Omitting the argument entirely must keep the old behaviour — every
  // existing call site passes two arguments.
  assert.match(formatMacroLine({ calories: 686, protein: 42 }), /686/);
});

test("the catalog actually produces the state this guards", () => {
  // If the estimator ever resolves every dish, this rule stops having a live
  // case and someone should be told, not left guessing why it never fires.
  const provisional = DISHES.filter((d) => d.macrosProvisional);
  assert.ok(
    provisional.length > 0,
    "no provisional dish in the catalog — if the estimator now covers everything, revisit this rule rather than deleting it",
  );
});

test("every dish either carries usable macros or is flagged provisional", () => {
  // Law 8's positive half. The assertion is FINITENESS, not positivity — and
  // that distinction is the whole point.
  //
  // First draft asserted `calories > 0` and failed on diet-coke-can, whose
  // macros are 0/0/0/0. Those zeros are correct: a diet cola really does have
  // no energy, and the estimator computed them. Meanwhile coke-can carries
  // {protein 3, carbs 22, fat 4, calories 140} — impossible for a cola, no
  // protein or fat in it — and is correctly flagged provisional.
  //
  // So the placeholder here reads as plausible numbers and the honest datum
  // reads as empty. Treating zero as "missing" would gate the truthful dish
  // and pass the fabricated one — which is precisely the zero-fill confusion
  // M0-FINDINGS §7 warns about, arrived at from the opposite direction.
  for (const d of DISHES) {
    if (d.macrosProvisional) continue;
    for (const [key, value] of Object.entries(d.macros)) {
      assert.ok(
        typeof value === "number" && Number.isFinite(value) && value >= 0,
        `${d.slug}.macros.${key} is not a usable number and the dish is not flagged provisional`,
      );
    }
  }
});

test("the dish surfaces pass provenance through, not just the estimate flag", () => {
  // The bug was call sites dropping the second flag on the floor, which no
  // type-checker catches — both params are optional booleans.
  const wired = [
    "DishCard.tsx",
    path.join("landing", "FlipCard.tsx"),
  ];
  for (const rel of wired) {
    const src = fs.readFileSync(path.join(COMPONENTS, rel), "utf8");
    assert.match(
      src,
      /formatMacroLine\([^)]*macrosProvisional/,
      `${rel} must forward macrosProvisional`,
    );
  }
});

test("the PDP spec gates its figures on provenance too", () => {
  const src = fs.readFileSync(path.join(COMPONENTS, "menu", "DishSpec.tsx"), "utf8");
  assert.match(src, /macrosProvisional \?/);
  assert.match(src, /MACROS_PENDING_LABEL/);
});
