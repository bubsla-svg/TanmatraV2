/**
 * Whether a merged (static + DB) dish's allergen list counts as reviewed.
 * The RD gate in the CMS (`allergen_review_state`) is the explicit human
 * verdict, so "reviewed" clears the static catalog's fail-closed
 * `allergensReviewed: false` (stamped by _deriveAllergens when the seed had
 * no curated list and an ingredient it couldn't classify); any other state
 * keeps the static flag, and the `unreviewed_dish` gate refuses those rows at
 * checkout anyway.
 *
 * Its own module (not menuResolver.ts) so the regression test stays DB-free:
 * menuResolver transitively imports @workspace/db, which refuses to load
 * without DATABASE_URL.
 */
export function resolveAllergensReviewed(
  staticFlag: boolean | undefined,
  reviewState: "pending_review" | "reviewed" | "blocked",
): boolean | undefined {
  return reviewState === "reviewed" ? true : staticFlag;
}
