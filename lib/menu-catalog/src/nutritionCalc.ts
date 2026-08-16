/**
 * Ingredient → macro calculator.
 *
 * Parses a dish's ingredient line ("Broccoli – 100 g · Olive oil – 2 tbsp · …"),
 * converts each quantity to grams, looks the ingredient up in a per-100g
 * nutrition reference table, scales, and sums. Returns the computed macros plus
 * a coverage/confidence report so callers can decide whether to trust or flag
 * the result (never present a low-coverage estimate as verified).
 *
 * The reference table is injected (see nutritionTable.ts) so this engine is
 * pure and unit-testable, and the same code powers both the one-off backfill of
 * the seed catalog and the live ingest of new Petpooja/CMS items.
 */

export interface NutritionPer100g {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  sugarG: number;
}

export type NutritionTable = Record<string, NutritionPer100g>;

export interface ParsedIngredient {
  /** normalized lookup name */
  name: string;
  /** resolved weight in grams (0 for "to taste"/negligible) */
  grams: number;
  /** original text of the line */
  raw: string;
}

export interface DishMacros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  sugarG: number;
}

export interface DishMacrosResult {
  macros: DishMacros;
  /** fraction (0–1) of weighed grams whose ingredient was found in the table */
  coverage: number;
  matchedCount: number;
  totalCount: number;
  /** ingredients that had weight but no table entry */
  unmatched: string[];
  /** high ≥ .85 coverage, med ≥ .6, else low. Demoted a tier when the summed
   * kcal disagrees with the Atwater estimate by > 20% (a mis-weighed row). */
  confidence: "high" | "med" | "low";
  /** 4·protein + 4·carbs + 9·fat — the macros' own implied energy. */
  atwaterKcal: number;
  /** |atwaterKcal − kcal| / kcal (0 when there are no calories). A large value
   * means the dish's stated energy can't be reconciled with its macros, which
   * almost always signals a portion/parse error rather than a real result. */
  atwaterDeltaPct: number;
  /** atwaterDeltaPct ≤ 0.15 — the macro row is internally coherent. */
  atwaterConsistent: boolean;
}

// ── Quantity parsing ────────────────────────────────────────────────────────

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅛": 0.125,
};

/** "½", "6–8", "1.5", "2" → number (ranges average). null if not a quantity. */
export function parseQuantity(token: string): number | null {
  let t = token.trim();
  if (!t) return null;
  // unicode fraction, optionally after an integer ("1 ½")
  const uni = t.match(/(\d+)?\s*([½⅓⅔¼¾⅕⅛])/);
  if (uni) {
    const whole = uni[1] ? parseInt(uni[1], 10) : 0;
    return whole + (FRACTIONS[uni[2]!] ?? 0);
  }
  // range "6-8" / "6–8" → average
  const range = t.match(/^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)$/);
  if (range) return (parseFloat(range[1]!) + parseFloat(range[2]!)) / 2;
  // ascii fraction "1/2"
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1]!, 10) / parseInt(frac[2]!, 10);
  const num = t.match(/^\d+(?:\.\d+)?/);
  return num ? parseFloat(num[0]) : null;
}

// ── Unit → grams ─────────────────────────────────────────────────────────────

const NEGLIGIBLE =
  /to taste|as needed|as required|optional|a pinch|pinch|garnish|seasoning|light salt/i;

/** Units whose gram/ml weight is fixed regardless of the ingredient. */
const UNIT_FIXED: Record<string, number> = {
  g: 1,
  gm: 1,
  gms: 1,
  gram: 1,
  grams: 1,
  ml: 1, // 1 ml ≈ 1 g for the aqueous mixes in this catalog
  l: 1000,
  kg: 1000,
  clove: 3,
  cloves: 3,
  pinch: 0.3,
  inch: 8, // a "½ inch" knob of ginger ≈ 4 g
  scoop: 30, // 1 scoop whey protein
  can: 330, // a soft-drink can
  sachet: 1, // a stevia/sweetener sachet
};

// Spoon/cup measures are volumetric, so their gram weight depends on whether the
// ingredient is a dry solid or a liquid. These two tables come verbatim from the
// kitchen's own MEASUREMENTS reference (Tanmatra Kitchen Data Collection Sheet):
//   dry    → 1 cup 120 g · 1 tbsp 8 g · 1 tsp 3 g
//   liquid → 1 cup 240 ml · 1 tbsp 15 ml · 1 tsp 5 ml
// The previous single table treated every spoon as its *liquid* volume, which
// overstated dry powders/flours/spices by ~1.7× (see nutritionCalc.test.ts).
const SPOON_DRY: Record<string, number> = {
  tbsp: 8,
  tablespoon: 8,
  tsp: 3,
  teaspoon: 3,
  cup: 120,
  cups: 120,
};
const SPOON_LIQUID: Record<string, number> = {
  tbsp: 15,
  tablespoon: 15,
  tsp: 5,
  teaspoon: 5,
  cup: 240,
  cups: 240,
};

/** Ingredients measured by the spoon/cup that pour like a liquid (use ml-weights). */
const LIQUID_SIGNAL =
  /oil|milk|cream|water|juice|honey|sauce|vinegar|stock|syrup|curd|yogurt|yoghurt|ketchup|mayo|dressing|puree|chutney|pesto|wine|extract|essence|coke|soda|tea|slurry|\bdip\b|salsa|hummus|nutella|butter/i;

/**
 * Grams per "piece"/"medium"/"slice" for count-based ingredients, keyed by a
 * substring of the normalized name. Falls back to PIECE_DEFAULT.
 */
const PIECE_G: Array<[RegExp, number]> = [
  // Leaf herbs & aromatics counted by the leaf/sprig ("Curry leaves – 6–8",
  // "Mint leaves – 4–5", "Basil – 4 leaves"). One leaf weighs a fraction of a
  // gram — the old default of 50 g each turned an 8-leaf garnish into 400 g of
  // phantom food (see nutritionCalc.test.ts). These MUST precede the broader
  // fallbacks below so a leaf never resolves to PIECE_DEFAULT.
  [/curry leaf|curry leave|curry/, 0.3],
  [/mint/, 0.3],
  [/basil/, 0.5],
  [/coriander|cilantro/, 0.3],
  [/parsley/, 0.3],
  [/\bbay leaf\b|leaves|\bleaf\b/, 0.4],
  // Canned/bottled drinks counted as "1". The unit token is empty here
  // because the sheet writes the vessel into the NAME ("Diet Coke can - 1"),
  // so UNIT_FIXED's `can: 330` never fires and the row fell through to
  // PIECE_DEFAULT — 50 g for a 330 ml can, a 6.6× understatement that the
  // BOM overlay would then make authoritative for depletion and COGS.
  // Must precede the fruit/leaf entries below so "coke"/"soda" wins.
  [/\bcan\b|soda|coke|thums ?up|cola/, 330],
  [/banana/, 118],
  [/\bapple/, 180],
  [/egg/, 50],
  [/tomato/, 100],
  [/onion/, 110],
  [/cucumber/, 150],
  [/lemon/, 60],
  [/potato/, 150],
  [/carrot/, 60],
  [/orange/, 130],
  [/(green |red )?chili|chilli|jalape/, 6],
  [/garlic/, 3],
  [/ginger/, 15],
  [/bread|toast/, 28],
  [/tortilla|wrap|roti|chapati/, 45],
  [/pita/, 60],
  [/olive/, 4],
  [/date/, 8],
  [/mushroom/, 18],
  [/prawn|shrimp/, 12], // medium prawn, cleaned/deveined edible weight
  [/falafel/, 17], // one falafel ball
  [/tikka/, 30], // one marinated chicken/paneer tikka piece
  [/avocado/, 100], // edible flesh of a medium avocado
  [/almond/, 1.2], // one almond (count-based garnish)
];
const PIECE_DEFAULT = 50;

function pieceWeight(name: string): number {
  for (const [re, g] of PIECE_G) if (re.test(name)) return g;
  return PIECE_DEFAULT;
}

/** Resolve a parsed (qty, unit, name) into grams. */
export function toGrams(qty: number, unit: string, name: string): number {
  const u = unit.trim().toLowerCase();
  if (u in UNIT_FIXED) return qty * UNIT_FIXED[u]!;
  // Volumetric spoon/cup: pick the dry- or liquid-weight table by ingredient.
  if (u in SPOON_DRY) {
    const table = LIQUID_SIGNAL.test(name) ? SPOON_LIQUID : SPOON_DRY;
    return qty * table[u]!;
  }
  const pw = pieceWeight(name);
  if (/^(slice|slices|pc|pcs|piece|pieces|nos?|medium|leaf|leaves)$/.test(u))
    return qty * pw;
  if (/^large$/.test(u)) return qty * pw * 1.3;
  if (/^small$/.test(u)) return qty * pw * 0.7;
  // No/unknown unit: a small count reads as pieces, a big number as grams.
  if (!u) return qty <= 12 ? qty * pw : qty;
  return qty <= 12 ? qty * pw : qty; // unknown unit — treat like a count
}

// ── Name normalization ───────────────────────────────────────────────────────

/** lowercase, drop parentheticals, take the first of "a / b" alternatives. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // (ripe), (boiled al dente)
    .split(/\s*\/\s*/)[0]! // "almond milk / low-fat" → "almond milk"
    .replace(/\s+/g, " ")
    .trim();
}

// ── Line / description parsing ────────────────────────────────────────────────

/** Parse one "Name – Qty unit (note)" segment. Returns null if unparseable. */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = line.trim();
  if (!raw) return null;
  // split on the first en-dash/hyphen separating name from quantity
  const m = raw.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (!m) return null;
  const name = normalizeName(m[1]!);
  if (!name) return null;
  const qtyPart = m[2]!.trim();
  if (NEGLIGIBLE.test(qtyPart) && !/\d/.test(qtyPart)) {
    return { name, grams: 0, raw };
  }
  const qty = parseQuantity(qtyPart);
  if (qty === null) return { name, grams: 0, raw };
  // unit = first alphabetic token after the number
  const unitMatch = qtyPart.replace(/^[^a-zA-Z]*/, "").match(/^([a-zA-Z]+)/);
  const unit = unitMatch ? unitMatch[1]! : "";
  return { name, grams: Math.round(toGrams(qty, unit, name)), raw };
}

/**
 * Grams from a bare quantity string ("2 tbsp", "½ tsp (optional)", "6–8",
 * "200 g"), resolved against the ingredient's name for density/piece weight.
 *
 * Exists for callers that hold quantity and name SEPARATELY — the ops tables'
 * `recipe_ingredients.quantityText` / `.ingredient` split, and the BOM
 * backfill — where `parseIngredientLine` (which expects the combined
 * "Name – Qty" form) does not fit. The api-server's recipe-costing fallback
 * (`menuEngineering.loadDynamicRecipeCosts`) calls this to replace its old
 * `/(\d+)\s*g/` regex, which read every non-gram quantity — all 97 tbsp, 83
 * tsp, 31 ml, 7 pcs rows in the live sheet — as zero grams and therefore
 * zero cost.
 *
 * Three accepted shapes, tried in order:
 *   1. "Name – Qty" whole line (spaced dash only, so "sugar-free" and
 *      "asafoetida-not-in-inventory" never split mid-word): quantity is the
 *      part after the dash.
 *   2. Bare/leading quantity: "2 tbsp", "20 g olive oil", "1 medium (ripe)".
 *   3. Negligible phrasing ("to taste", "a pinch") → 0, matching
 *      parseIngredientLine's rule.
 * Unparseable input returns 0 — the same "contributes nothing" contract the
 * old regex had, so a caller treating 0 as absence keeps working.
 */
export function gramsFromQuantityText(
  text: string | null | undefined,
  ingredientName: string,
): number {
  if (!text) return 0;
  let t = text.trim();
  const dash = t.match(/^(.+?)\s[–—-]\s(.+)$/);
  if (dash) t = dash[2]!.trim();
  t = t.replace(/\([^)]*\)/g, " ").trim();
  if (!t) return 0;
  if (NEGLIGIBLE.test(t) && !/\d/.test(t)) return 0;
  const qty = parseQuantity(t);
  if (qty === null) return 0;
  // unit = first alphabetic token after the number (parseIngredientLine's rule)
  const unitMatch = t.replace(/^[^a-zA-Z]*/, "").match(/^([a-zA-Z]+)/);
  const unit = unitMatch ? unitMatch[1]! : "";
  return Math.round(toGrams(qty, unit, ingredientName.toLowerCase()));
}

/** Parse a full "A – x · B – y · …" longDescription into ingredients. */
export function parseLongDescription(text: string): ParsedIngredient[] {
  if (!text) return [];
  return text
    .split(/\s*·\s*/)
    .map(parseIngredientLine)
    .filter((x): x is ParsedIngredient => x !== null);
}

// ── Compute ──────────────────────────────────────────────────────────────────

const ZERO: DishMacros = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sodiumMg: 0,
  sugarG: 0,
};

/** Look an ingredient up in the table (exact, then loose substring match). */
export function lookup(name: string, table: NutritionTable): NutritionPer100g | null {
  if (table[name]) return table[name]!;
  // loose: a table key that is a whole-word subset of the ingredient, or v.v.
  const keys = Object.keys(table);
  for (const k of keys) {
    if (name === k) return table[k]!;
  }
  for (const k of keys) {
    if (name.includes(k) || k.includes(name)) return table[k]!;
  }
  return null;
}

/**
 * Compute a dish's macros from its full ingredient list — one "Name – Qty unit"
 * string per element (the shape stored in `DishData.ingredients`). This is the
 * preferred entry point: the abbreviated `longDescription` routinely drops
 * ingredients (the cooking oil, the protein in a variant dish), which silently
 * undercounts the result. Delegates to `computeDishMacros` by joining on the
 * middot separator it already understands.
 */
export function computeDishMacrosFromIngredients(
  ingredients: readonly string[],
  table: NutritionTable,
): DishMacrosResult {
  return computeDishMacros((ingredients ?? []).join(" · "), table);
}

/**
 * Compute a dish's macros from its ingredient longDescription. Only ingredients
 * with a positive weight AND a table match contribute; coverage reflects the
 * share of weighed grams that were matched.
 */
export function computeDishMacros(
  longDescription: string,
  table: NutritionTable,
): DishMacrosResult {
  const parsed = parseLongDescription(longDescription);
  const weighed = parsed.filter((p) => p.grams > 0);
  const macros: DishMacros = { ...ZERO };
  const unmatched: string[] = [];
  let matchedGrams = 0;
  let weighedGrams = 0;
  let matchedCount = 0;

  for (const ing of weighed) {
    weighedGrams += ing.grams;
    const ref = lookup(ing.name, table);
    if (!ref) {
      unmatched.push(ing.name);
      continue;
    }
    matchedCount++;
    matchedGrams += ing.grams;
    const f = ing.grams / 100;
    macros.kcal += ref.kcal * f;
    macros.proteinG += ref.proteinG * f;
    macros.carbsG += ref.carbsG * f;
    macros.fatG += ref.fatG * f;
    macros.fiberG += ref.fiberG * f;
    macros.sodiumMg += ref.sodiumMg * f;
    macros.sugarG += ref.sugarG * f;
  }

  const rounded: DishMacros = {
    kcal: Math.round(macros.kcal),
    proteinG: Math.round(macros.proteinG),
    carbsG: Math.round(macros.carbsG),
    fatG: Math.round(macros.fatG),
    fiberG: Math.round(macros.fiberG),
    sodiumMg: Math.round(macros.sodiumMg),
    sugarG: Math.round(macros.sugarG),
  };
  const coverage = weighedGrams > 0 ? matchedGrams / weighedGrams : 0;

  // Atwater self-check: the summed kcal should agree with 4·P + 4·C + 9·F. A
  // wide gap means a component was mis-weighed (e.g. a leaf garnish read as
  // hundreds of grams), so we never present such a row as high confidence.
  const atwaterKcal =
    4 * rounded.proteinG + 4 * rounded.carbsG + 9 * rounded.fatG;
  const atwaterDeltaPct =
    rounded.kcal > 0 ? Math.abs(atwaterKcal - rounded.kcal) / rounded.kcal : 0;
  const atwaterConsistent = atwaterDeltaPct <= 0.15;

  let confidence: DishMacrosResult["confidence"] =
    coverage >= 0.85 ? "high" : coverage >= 0.6 ? "med" : "low";
  // Demote a tier when the energy can't be reconciled with the macros.
  if (atwaterDeltaPct > 0.2) {
    confidence = confidence === "high" ? "med" : "low";
  }

  return {
    macros: rounded,
    coverage: Math.round(coverage * 100) / 100,
    matchedCount,
    totalCount: weighed.length,
    unmatched,
    confidence,
    atwaterKcal,
    atwaterDeltaPct: Math.round(atwaterDeltaPct * 100) / 100,
    atwaterConsistent,
  };
}
