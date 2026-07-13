import assert from "node:assert/strict";
import { test } from "node:test";
import { getAllergenDisclosure, allergensAreReviewed, type DishData } from "./index";

// Only the two fields the helpers read matter here.
function dish(partial: Partial<DishData>): DishData {
  return { allergens: [], ...partial } as DishData;
}

test("a reviewed empty list is an affirmative 'no allergens' disclosure", () => {
  const d = dish({ allergens: [] });
  assert.equal(allergensAreReviewed(d), true);
  assert.deepEqual(getAllergenDisclosure(d), { state: "reviewed", allergens: [] });
});

test("absent flag defaults to reviewed so the legacy catalog is unaffected", () => {
  const d = dish({ allergens: ["Dairy"] });
  assert.equal(allergensAreReviewed(d), true);
  assert.deepEqual(getAllergenDisclosure(d), {
    state: "reviewed",
    allergens: ["Dairy"],
  });
});

test("allergensReviewed:false is 'unchecked', never an empty 'no allergens'", () => {
  const d = dish({ allergens: [], allergensReviewed: false });
  assert.equal(allergensAreReviewed(d), false);
  assert.deepEqual(getAllergenDisclosure(d), { state: "unchecked" });
});

test("an unchecked source fails closed even if it carried a list", () => {
  // "None listed in system" is the empty case, but an unreviewed non-empty
  // list is equally untrustworthy — the disclosure stays 'unchecked'.
  const d = dish({ allergens: ["Dairy"], allergensReviewed: false });
  assert.deepEqual(getAllergenDisclosure(d), { state: "unchecked" });
});
