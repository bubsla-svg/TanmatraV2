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
  /** high ≥ .85 coverage, med ≥ .6, else low */
  confidence: "high" | "med" | "low";
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

const NEGLIGIBLE = /to taste|as needed|as required|optional|a pinch|pinch|garnish/i;

/** Generic unit → grams multipliers (per 1 unit). */
const UNIT_G: Record<string, number> = {
  g: 1,
  gm: 1,
  gms: 1,
  gram: 1,
  grams: 1,
  ml: 1,
  l: 1000,
  kg: 1000,
  tbsp: 15,
  tablespoon: 15,
  tsp: 5,
  teaspoon: 5,
  cup: 200,
  cups: 200,
  clove: 3,
  cloves: 3,
  pinch: 0.3,
};

/**
 * Grams per "piece"/"medium"/"slice" for count-based ingredients, keyed by a
 * substring of the normalized name. Falls back to PIECE_DEFAULT.
 */
const PIECE_G: Array<[RegExp, number]> = [
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
  if (u in UNIT_G) return qty * UNIT_G[u]!;
  const pw = pieceWeight(name);
  if (/^(slice|slices|pc|pcs|piece|pieces|nos?|medium)$/.test(u)) return qty * pw;
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
  const confidence: DishMacrosResult["confidence"] =
    coverage >= 0.85 ? "high" : coverage >= 0.6 ? "med" : "low";

  return {
    macros: rounded,
    coverage: Math.round(coverage * 100) / 100,
    matchedCount,
    totalCount: weighed.length,
    unmatched,
    confidence,
  };
}
