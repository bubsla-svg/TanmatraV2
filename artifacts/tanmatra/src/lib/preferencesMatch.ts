import type { DishData } from "@workspace/menu-catalog";
import { DISHES } from "@workspace/menu-catalog";
import {
  evaluateDishForPreferences as sharedEvaluate,
  type DishMatchResult as SharedDishMatchResult,
  type PreferencesForMatch,
  matchIngredientTerm,
  getEquivalentTerms,
} from "@workspace/preferences-match";
import type { UserPreferences } from "./preferencesApi";

export type DishMatchResult = SharedDishMatchResult;

export function evaluateDishForPreferences(
  dish: DishData,
  prefs: UserPreferences | null,
): DishMatchResult {
  // Client uses default (soft) mode: dislikes / keto carb-cap surface
  // as warnings, not blocks, so users can still browse. The server
  // checkout gate independently runs in `strict: true` mode — that is
  // the canonical patient-safety enforcement point.
  return sharedEvaluate(dish, prefs as PreferencesForMatch | null);
}

export function rankDishesForPreferences(
  dishes: DishData[],
  prefs: UserPreferences | null,
): Array<{ dish: DishData; match: DishMatchResult }> {
  return dishes
    .map((dish) => ({ dish, match: evaluateDishForPreferences(dish, prefs) }))
    .sort((a, b) => {
      if (a.match.blocked !== b.match.blocked) return a.match.blocked ? 1 : -1;
      if (a.match.cuisineMatch !== b.match.cuisineMatch)
        return a.match.cuisineMatch ? -1 : 1;
      const aw = a.match.warnings.length;
      const bw = b.match.warnings.length;
      if (aw !== bw) return aw - bw;
      if (a.match.reasons.length !== b.match.reasons.length)
        return b.match.reasons.length - a.match.reasons.length;
      // Customer reviews tip the tie: a Bayesian-shrunk rating that nudges
      // well-rated dishes up while not over-rewarding 1-review noise.
      return reviewScore(b.dish) - reviewScore(a.dish);
    });
}

const REVIEW_PRIOR_RATING = 3.5;
const REVIEW_PRIOR_WEIGHT = 4;
function reviewScore(dish: DishData): number {
  const r = dish.averageRating;
  const n = dish.reviewCount ?? 0;
  if (r == null || n <= 0) return REVIEW_PRIOR_RATING;
  return (
    (r * n + REVIEW_PRIOR_RATING * REVIEW_PRIOR_WEIGHT) /
    (n + REVIEW_PRIOR_WEIGHT)
  );
}

/**
 * `pool` defaults to the static build-time seed (its isAvailable is always
 * true), so callers should pass the live catalog from `useMenuCatalog()`
 * whenever one is in scope — otherwise a dish an ops/RD editor has pulled
 * from the live menu can still be suggested here as a "safer swap."
 */
export function findSmartSwap(
  dish: DishData,
  prefs: UserPreferences | null,
  pool: DishData[] = DISHES,
): DishData | null {
  if (!prefs) return null;
  const original = evaluateDishForPreferences(dish, prefs);
  if (!original.blocked && original.warnings.length === 0) return null;
  const scored = pool.filter(
    (d) => d.id !== dish.id && d.isAvailable && d.category === dish.category,
  )
    .map((d) => ({ d, m: evaluateDishForPreferences(d, prefs) }))
    .filter(({ m }) => !m.blocked && m.warnings.length === 0);
  if (scored.length === 0) return null;
  scored.sort((a, b) => {
    if (a.m.cuisineMatch !== b.m.cuisineMatch) return a.m.cuisineMatch ? -1 : 1;
    if (a.m.reasons.length !== b.m.reasons.length)
      return b.m.reasons.length - a.m.reasons.length;
    return Math.abs(a.d.price - dish.price) - Math.abs(b.d.price - dish.price);
  });
  return scored[0]?.d ?? null;
}

/**
 * Best-effort allergen check for selected CUSTOMIZATION option NAMES.
 *
 * Customization options in the catalog carry only { name, priceModifier } —
 * NO structured allergen/ingredient data — so this can only text-match the
 * user's declared allergens (expanded via their equivalence clusters)
 * against the option NAME. It reliably catches common cases ("Extra Peanut
 * Sauce", "Add Cheese") but CANNOT certify absence: an option whose name
 * doesn't reveal its allergen (e.g. "Chef's Special") won't be caught. This
 * is a data-model limitation, not a guarantee — the UI must surface it as an
 * advisory clash, never as a "verified safe" signal. Mirrors the base
 * engine's philosophy of only ever ADDING allergen warnings, never
 * subtracting.
 */
export function modifierClashAllergens(
  optionNames: string[],
  prefs: UserPreferences | null,
): string[] {
  if (!prefs?.allergens?.length || optionNames.length === 0) return [];
  // Strip "X-free" / "X free" compounds before matching: a hyphen is a word
  // boundary for \b, so "Nut-Free Granola" would otherwise flag a nut clash
  // on the explicitly nut-free option — routing the user into the consent
  // sheet on exactly the SAFE choice. Deliberately narrow: only the
  // "<term>-free"/"<term> free" phrase itself is removed, so "Dairy-Free
  // Cheese" still flags via "cheese" (conservative — we can't verify the
  // substitute is actually dairy-free, and over-warning is the safe
  // direction for anything this can't prove).
  const text = optionNames
    .join(" | ")
    .toLowerCase()
    .replace(/\b[\w]+(?:[ -][\w]+)?[ -]free\b/g, " ");
  const clashes: string[] = [];
  for (const a of prefs.allergens) {
    const equivs = getEquivalentTerms(a.toLowerCase());
    if (equivs.some((eq) => eq && matchIngredientTerm(text, eq))) {
      clashes.push(a);
    }
  }
  return clashes;
}
