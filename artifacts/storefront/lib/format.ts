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
 * The "~" prefix is the catalog's `macrosEstimated` flag, kept verbatim: a
 * measured value and an estimated one must never render identically on a
 * clinical surface.
 */
const approx = (estimated?: boolean): string => (estimated ? "~" : "");

/** `~686 kcal` — energy, always with its unit. */
export function formatKcal(calories: number, estimated?: boolean): string {
  return `${approx(estimated)}${Math.round(calories)} kcal`;
}

/** `~42 g` — a macro weight. Spaced, the typographic norm for a unit. */
export function formatGrams(grams: number, estimated?: boolean): string {
  return `${approx(estimated)}${Math.round(grams)} g`;
}

/**
 * `~686 kcal · ~42 g P` — the one-line summary a dense list shows (menu card,
 * cart line). Protein stays abbreviated: these render in a width-constrained
 * column where "protein" spelled out wraps the line.
 */
export function formatMacroLine(
  macros: { calories: number; protein: number },
  estimated?: boolean,
): string {
  return `${formatKcal(macros.calories, estimated)} · ${formatGrams(macros.protein, estimated)} P`;
}
