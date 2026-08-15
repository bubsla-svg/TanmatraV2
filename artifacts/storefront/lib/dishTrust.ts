/**
 * What the storefront may truthfully SAY about a dish (TNM-MENU-01 M-5 §3.4).
 *
 * Pure and DOM/network-free so `node --test` can pin it.
 *
 * THE PROBLEM THIS SOLVES — M-0 finding F8, confirmed live against
 * production on 2026-08-15 (145 dishes served by /api/menu/public):
 *
 *   - 18 dishes carry `ingredients: ["fresh ingredients"]` — a seed
 *     placeholder, not a recipe. `dishCardSummary` treated that string as a
 *     distinctive ingredient and printed it verbatim, so the card's one
 *     differentiating line read "fresh ingredients".
 *   - 16 dishes carry the byte-identical macro bucket
 *     460 kcal / 18 g P / 45 g C / 14 g F. These are not measurements; they
 *     are one placeholder row copied across unrelated dishes (Aam Panna, a
 *     mango cooler, and Garlic Bread both claim 460 kcal / 18 g protein).
 *   - The union is 21 dishes. Only ONE of them is flagged
 *     `macrosProvisional`, so the catalog's existing "being verified" gate
 *     misses essentially all of it and the numbers render as fact.
 *
 * On a clinical platform a fabricated macro is worse than an absent one: a
 * customer counting protein acts on it. So the card refuses to print numbers
 * it cannot stand behind, and says so, rather than showing a confident lie.
 *
 * The fix is a RENDER guard, deliberately. The real repair is data-side
 * (M-6 supplies real macros and copy); until it lands this keeps the claim
 * honest without inventing a substitute number.
 */

/** The exact seed placeholder macro bucket. Matched on all four
 *  macronutrients together — any one of them alone is a plausible real
 *  value, the specific combination across unrelated dishes is not. */
const STUB_MACROS = { calories: 460, protein: 18, carbs: 45, fat: 14 } as const;

/** The seed placeholder ingredient list, matched as the WHOLE list: a dish
 *  whose only listed ingredient is the words "fresh ingredients" has no
 *  recipe on file. A real dish that happens to mention fresh ingredients
 *  among several others is untouched. */
const STUB_INGREDIENT = "fresh ingredients";

export interface DishTrustInput {
  ingredients?: string[] | null;
  macros?: { calories: number; protein: number; carbs: number; fat: number } | null;
  macrosEstimated?: boolean;
  macrosProvisional?: boolean;
}

/**
 * True when the dish's ingredient list is the seed placeholder rather than a
 * real recipe — so nothing derived from `ingredients` may be shown.
 */
export function hasStubIngredients(dish: DishTrustInput): boolean {
  const list = dish.ingredients ?? [];
  return list.length === 1 && (list[0] ?? "").trim().toLowerCase() === STUB_INGREDIENT;
}

/** True when macros match the seed placeholder bucket exactly. */
export function hasStubMacros(dish: DishTrustInput): boolean {
  const m = dish.macros;
  if (!m) return false;
  return (
    m.calories === STUB_MACROS.calories &&
    m.protein === STUB_MACROS.protein &&
    m.carbs === STUB_MACROS.carbs &&
    m.fat === STUB_MACROS.fat
  );
}

/**
 * How much the UI may claim about this dish's numbers.
 *
 * - `"verified"` — curated values; render them plainly.
 * - `"estimated"` — ingredient-calculator derived (`macrosEstimated`);
 *   render with the ≈ prefix AND the page-level legend that explains it.
 *   72% of the live catalog is in this tier, which is exactly why a bare
 *   unexplained tilde (defect S-6) was not acceptable.
 * - `"unverified"` — placeholder or explicitly provisional. Render NO
 *   numbers; say they are being verified.
 */
export type MacroTrust = "verified" | "estimated" | "unverified";

export function macroTrust(dish: DishTrustInput): MacroTrust {
  if (dish.macrosProvisional === true) return "unverified";
  if (hasStubMacros(dish)) return "unverified";
  if (!dish.macros || dish.macros.calories === 0) return "unverified";
  if (dish.macrosEstimated === true) return "estimated";
  return "verified";
}

/**
 * True when ANY part of this dish's content is placeholder — used by the
 * display-integrity audit (§4.2) and by the e2e assertion that zero cards
 * carrying the stub signature reach the customer with their stub text
 * intact.
 */
export function hasStubContent(dish: DishTrustInput): boolean {
  return hasStubIngredients(dish) || hasStubMacros(dish);
}
