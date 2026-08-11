/**
 * Regression test for the production "Safety block / Retry pricing" checkout
 * dead-end (2026-08-11): the merged catalog spread the static seed's
 * fail-closed `allergensReviewed: false` over dishes whose DB row the RD had
 * already marked `allergen_review_state = 'reviewed'`, so the strict quote
 * gate 422'd `unchecked_allergens` on RD-cleared dishes — for every customer,
 * with a Retry button that could never succeed.
 *
 * DB-free on purpose: the rule under test (resolveAllergensReviewed) is pure,
 * and the seed fixture it protects (a static dish that IS fail-closed) comes
 * from the real @workspace/menu-catalog build.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DISHES } from "@workspace/menu-catalog";
import { evaluateDishForPreferences } from "@workspace/preferences-match";
import { resolveAllergensReviewed } from "./allergenReview";

// The dish from the customer bug report. If the seed ever stops failing it
// closed, this fixture assertion — not the rule test — is what should move.
const REPORTED_SLUG = "barbeque-grilled-chicken-rice-bowl";

test("the static seed really does fail some dishes closed (fixture guard)", () => {
  const dish = DISHES.find((d) => d.slug === REPORTED_SLUG);
  assert.ok(dish, `${REPORTED_SLUG} disappeared from the static catalog`);
  assert.equal(
    dish.allergensReviewed,
    false,
    "expected the seed to fail this dish closed — if allergen curation fixed it, pick another fail-closed fixture",
  );
});

test("an RD 'reviewed' DB verdict supersedes the seed's fail-closed flag", () => {
  assert.equal(resolveAllergensReviewed(false, "reviewed"), true);
  assert.equal(resolveAllergensReviewed(undefined, "reviewed"), true);
});

test("pending/blocked rows keep the static flag (unreviewed_dish gate owns them)", () => {
  assert.equal(resolveAllergensReviewed(false, "pending_review"), false);
  assert.equal(resolveAllergensReviewed(false, "blocked"), false);
  assert.equal(resolveAllergensReviewed(undefined, "pending_review"), undefined);
});

test("a merged reviewed dish passes the strict checkout gate end to end", () => {
  const stat = DISHES.find((d) => d.slug === REPORTED_SLUG)!;
  const mergedShape = {
    ...stat,
    rdReviewState: "reviewed" as const,
    allergensReviewed: resolveAllergensReviewed(stat.allergensReviewed, "reviewed"),
  };
  const verdict = evaluateDishForPreferences(mergedShape, null, { strict: true });
  assert.equal(
    verdict.blocked,
    false,
    `strict gate still blocks the merged dish: ${JSON.stringify(verdict.blockReasons)}`,
  );
});
