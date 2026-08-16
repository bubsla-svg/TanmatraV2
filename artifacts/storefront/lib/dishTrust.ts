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
 * Canonical key for a macro tuple. All four macronutrients together — the
 * same basis `hasStubMacros` uses, and for the same reason: any single value
 * recurring is ordinary, the exact quadruple recurring across unrelated
 * dishes is not a measurement.
 */
function macroKey(m: NonNullable<DishTrustInput["macros"]>): string {
  return `${m.calories}|${m.protein}|${m.carbs}|${m.fat}`;
}

/**
 * The macro tuples that appear on MORE THAN ONE dish in a given set.
 *
 * GENERALISES THE STUB CHECK (flipbook finding F-1). `hasStubMacros` above
 * matches one hard-coded bucket found by hand during M-0. F-1 showed that was
 * the visible corner of a much larger problem: on the live catalog 93 dishes
 * share macros, drawn from only 32 distinct tuples, and just 15 of those
 * dishes carry a flag the existing gate can see. So a Diet Coke advertises
 * "≈140 kcal · ≈3 g P" (it is 0/0) and a single boiled egg advertises
 * "460 kcal · 28 g P" with no estimate marker at all.
 *
 * The rule that catches all of it without a hard-coded list: two unrelated
 * dishes cannot have measured their way to a byte-identical macro quadruple.
 * One of them is wrong, we cannot tell which, so neither may claim the number
 * as fact.
 *
 * NOTE WHICH SET TO PASS. The static fallback catalog is clean — 116 dishes,
 * 116 distinct tuples — so building this from `@workspace/menu-catalog` would
 * find nothing. The duplication lives in the DB-governed payload, which means
 * the only set that detects it is the one actually being rendered. Callers
 * pass the dishes they are about to show.
 */
export function buildSharedMacroKeys(
  dishes: readonly DishTrustInput[],
): ReadonlySet<string> {
  const seen = new Map<string, number>();
  for (const d of dishes) {
    if (!d.macros) continue;
    const k = macroKey(d.macros);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const shared = new Set<string>();
  for (const [k, n] of seen) if (n > 1) shared.add(k);
  return shared;
}

/**
 * How much the UI may claim about this dish's numbers.
 *
 * - `"verified"` — curated values; render them plainly.
 * - `"estimated"` — ingredient-calculator derived (`macrosEstimated`);
 *   render with the ≈ prefix AND the page-level legend that explains it.
 *   72% of the live catalog is in this tier, which is exactly why a bare
 *   unexplained tilde (defect S-6) was not acceptable.
 * - `"unverified"` — placeholder, explicitly provisional, or sharing its
 *   macro tuple with another dish in `sharedMacroKeys`. Render NO numbers;
 *   say they are being verified.
 *
 * `sharedMacroKeys` is optional here so the function stays a pure one-dish
 * predicate for tests and for callers that genuinely have no catalog context.
 * It is NOT optional at the render layer: `DishCard` and `MacroLegend` both
 * require the prop, so a new surface cannot forget it without a type error.
 */
export type MacroTrust = "verified" | "estimated" | "unverified";

export function macroTrust(
  dish: DishTrustInput,
  sharedMacroKeys?: ReadonlySet<string>,
): MacroTrust {
  if (dish.macrosProvisional === true) return "unverified";
  if (hasStubMacros(dish)) return "unverified";
  if (!dish.macros || dish.macros.calories === 0) return "unverified";
  // A tuple shared with another dish can never read as fact — not even as an
  // estimate, because the ≈ marker still asserts "we computed this for THIS
  // dish", which is exactly the claim a copied row cannot support.
  if (sharedMacroKeys?.has(macroKey(dish.macros))) return "unverified";
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
