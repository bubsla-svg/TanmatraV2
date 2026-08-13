/**
 * Dish copy derivation (N5.4). Pure and DOM-free so `node --test` can pin it.
 *
 * THE PROBLEM THIS SOLVES: no dish in the catalog carries real prose. Both
 * `description` ("Spaghetti pasta, Olive oil, Garlic, and more.") and
 * `longDescription` ("Spaghetti pasta – 120 g (boiled al dente) · Olive oil –
 * 2 tbsp · …") are ingredient lists — so the PDP rendered the ingredient list
 * as its subtitle and then repeated the SAME list in the Ingredients
 * accordion below, in a different separator dialect.
 *
 * Until real descriptions exist server-side (the actual fix, data-side), the
 * storefront can at least stop printing one list twice: the subtitle becomes
 * ingredient NAMES only, and the accordion keeps names + quantities. That is
 * a real hierarchy — "what's in it" over "how much of each" — rather than
 * two renderings of one string.
 */

/** Quantity separator used by the catalog: a spaced en/em dash or hyphen.
 *  Spaced on purpose — "low-fat milk" and "6–8 cloves" must NOT split, and
 *  neither carries spaces around its dash. */
const QTY_SEPARATOR = /\s[–—-]\s/;

/**
 * "Activated charcoal powder – ½ tsp" -> "Activated charcoal powder".
 * An entry with no quantity suffix is returned as-is (trimmed).
 */
export function ingredientName(entry: string): string {
  const [name] = entry.split(QTY_SEPARATOR);
  return (name ?? entry).trim();
}

/**
 * A subtitle built from ingredient names. Caps the list so a 12-ingredient
 * dish doesn't print a paragraph, and says so honestly ("+N more") rather
 * than truncating mid-word the way the catalog's own `description` does
 * ("Almond milk / low, and more.").
 *
 * Middot-separated, NOT comma-separated, and that is load-bearing: a single
 * catalog entry can itself contain commas ("Zucchini, bell peppers, broccoli
 * – ½ cup"), so a comma join silently reads as three ingredients where the
 * data means one — and the "+N more" count then disagrees with what the eye
 * counts. The middot is also already the catalog's own entry separator in
 * `longDescription`, so this borrows an existing convention rather than
 * inventing a dialect.
 */
export function ingredientSummary(ingredients: string[], max = 4): string {
  const names = ingredients.map(ingredientName).filter(Boolean);
  if (names.length === 0) return "";
  const shown = names.slice(0, max).join(" · ");
  if (names.length <= max) return shown;
  return `${shown} · +${names.length - max} more`;
}
