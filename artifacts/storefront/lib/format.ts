/** Paise → a GST-inclusive ₹ string with en-IN grouping. Display only — the
 *  server quote is always the source of truth for anything charged. */
export function formatPaise(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

/**
 * Macro rendering (N5.7). One dish used to print its numbers in three
 * dialects: "~42 g" on the PDP (spaced), "~42g P" on the menu card and the
 * cart line (unspaced), and a bare "42" under a "P" label in the quick-view
 * sheet — the same value, three ways, on four screens a customer walks
 * through in one session. These are the only spellings; every macro surface
 * consumes them.
 *
 * The "≈" prefix is the catalog's `macrosEstimated` flag, kept verbatim: a
 * measured value and an estimated one must never render identically on a
 * clinical surface.
 *
 * The glyph is U+2248 ALMOST EQUAL TO, not an ASCII tilde (TNM-MENU-01 M-5
 * §3.4). It was "~", which reads as a stray character next to a number
 * rather than as a mathematical qualifier — and, since 104 of the 145 live
 * dishes are estimated, that unexplained mark was on most of the menu.
 * Pairing the correct glyph with the page-level legend (MacroLegend, shown
 * on /menu whenever an estimated dish is visible) is what closes defect S-6;
 * changing the glyph alone would not have.
 */
const approx = (estimated?: boolean): string => (estimated ? "≈" : "");

/**
 * The space between a value and its unit is NON-BREAKING (U+00A0). These
 * strings render in narrow columns — the checkout line item is ~150px wide —
 * and an ordinary space let "~2 g P" wrap as "~2" / "g P", orphaning the unit
 * from its number on the screen right before payment. A quantity and its unit
 * are one token typographically; they must not be separable by a line break.
 */
const NBSP = "\u00a0";

/** `≈686 kcal` — energy, always with its unit. */
export function formatKcal(calories: number, estimated?: boolean): string {
  return `${approx(estimated)}${Math.round(calories)}${NBSP}kcal`;
}

/** `≈42 g` — a macro weight. */
export function formatGrams(grams: number, estimated?: boolean): string {
  return `${approx(estimated)}${Math.round(grams)}${NBSP}g`;
}

/**
 * What a dish shows instead of numbers when its macros are provisional.
 *
 * `macrosProvisional` marks a dish whose seed macros were a duplicated
 * placeholder bucket AND for which the ingredient calculator produced no
 * high-confidence estimate (menu-catalog's DISHES derivation). The stored
 * numbers are a bucket, not a measurement of that dish.
 *
 * The flag has carried the instruction "the UI gates them behind a 'being
 * verified' state" in its own doc comment since it was introduced, and no
 * surface implemented it — every consumer read `macrosEstimated` alone, so a
 * placeholder rendered as a confident figure. On a clinical-nutrition product
 * that is the worst way to be wrong: a number someone may plan a diabetic or
 * renal diet around, asserted with no basis under it.
 */
export const MACROS_PENDING_LABEL = "Nutrition coming soon";

/**
 * `≈686 kcal · ≈42 g P` — the one-line summary a dense list shows (menu card,
 * cart line). Protein stays abbreviated: these render in a width-constrained
 * column where "protein" spelled out wraps the line.
 *
 * `provisional` outranks `estimated`: an estimate is a real calculation worth
 * qualifying with ≈; a placeholder is not a value at all.
 */
export function formatMacroLine(
  macros: { calories: number; protein: number },
  estimated?: boolean,
  provisional?: boolean,
): string {
  if (provisional) return MACROS_PENDING_LABEL;
  return `${formatKcal(macros.calories, estimated)} · ${formatGrams(macros.protein, estimated)}${NBSP}P`;
}
