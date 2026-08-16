/**
 * Generate/refresh scripts/data/bom-ingredient-map.csv — the REVIEWED
 * ingredient→inventory mapping the BOM backfill plans through.
 *
 * This is the plan-then-apply control from M-3, applied to naming: a wrong
 * ingredient→item mapping is a wrong cost AND a wrong depletion on every dish
 * using that ingredient, so each one is written down once, reviewed by a
 * human, and versioned — never re-derived fuzzily at runtime. The fuzzy
 * runtime match this replaces resolved 77 of 198 names and costed
 * "whole wheat tortilla" as sesame seeds (torTILLa ⊇ "till").
 *
 * Every generated row is status=`proposed`. A human flips rows to `accepted`
 * (editing verdict/item_no where the proposal is wrong); the backfill refuses
 * to write from anything else. Re-running this script PRESERVES accepted rows
 * verbatim and only re-proposes the rest, so review work is never clobbered.
 *
 * Dry-run prints a summary; --write rewrites the CSV.
 *   pnpm --filter @workspace/scripts exec tsx ./src/propose-bom-map.ts --write
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadMapping,
  parseSheetIngredient,
  serializeMapping,
  type MappingRow,
  type SheetDishInput,
  type SheetInventoryInput,
} from "./lib/bomPlan";

const DATA_DIR = resolve(process.cwd(), "data");
const SHEET_PATH = resolve(DATA_DIR, "kitchen-data-collection.json");
const CSV_PATH = resolve(DATA_DIR, "bom-ingredient-map.csv");
const WRITE = process.argv.includes("--write");

interface SheetData {
  dishes: SheetDishInput[];
  inventory: SheetInventoryInput[];
}

const sheet: SheetData = JSON.parse(readFileSync(SHEET_PATH, "utf8"));

// Same row filter as seed-ops-data.ts's inventoryRows(): a row must have an
// integer item number and a non-blank product to exist in the DB at all.
function intNo(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
const inventoryByNo = new Map<number, string>();
for (const r of sheet.inventory) {
  const no = intNo(r.no);
  const product = (r.product || "").trim();
  if (no != null && product) inventoryByNo.set(no, product);
}

// ── Hand-curated aliases ─────────────────────────────────────────────────────
// key (normalizeName of the sheet ingredient) → [item_no, rationale].
// Most of these exist because the inventory sheet spells things its own way:
// PARSELY, SPEGHETTI, GREEN CHILLI, BUTTOM MUSHROOM, DALCHIINI (= cinnamon),
// MOZERALLA. The two-way-substring matcher could never see through that; a
// human reading both lists can, once, here.
const ALIASES: Record<string, [number, string]> = {
  eggs: [2, "EGG 2 UNITS is the egg line; neither string contains the other"],
  egg: [2, "same as eggs"],
  "boiled eggs": [2, "preparation of the same item"],
  "grilled chicken": [1, "menu shorthand for CHICKEN BREAST BONELESS, grilled"],
  "grilled chicken breast": [1, "same item, cooked"],
  "chicken breast": [1, "exact item, sheet spells it BONELESS"],
  chicken: [1, "only chicken raw-protein line on the inventory"],
  "shredded chicken": [1, "preparation of the same item"],
  prawns: [3, "PRAWNS16/20 JUMBO is the only prawn line"],
  "grilled prawns": [3, "same item, cooked"],
  parsley: [12, "inventory spells it PARSELY"],
  "green chili": [106, "inventory spells it GREEN CHILLI"],
  "green chilies": [106, "same, plural"],
  "chili flakes": [99, "BIG BELL CHILLI FLAKES"],
  "dry red chili flakes": [99, "same item"],
  "red chili flakes": [99, "same item"],
  "black pepper": [85, "BLACK CHINESE PEPPER is the black-pepper line"],
  pepper: [85, "bare 'pepper' on this sheet means black pepper"],
  "spaghetti pasta": [111, "inventory spells it SPEGHETTI"],
  spaghetti: [111, "same"],
  "penne pasta": [15, "PASTA WHOLE WHEAT PENNE"],
  "whole wheat penne": [15, "exact item"],
  mushrooms: [87, "inventory spells it BUTTOM MUSHROOM"],
  mushroom: [87, "same"],
  almonds: [84, "ALMOND DOUBLE TOUCH is the almond line"],
  blueberries: [14, "MALA CRUSH BLUEBERRY — the sheet's only blueberry line; frozen-mix alternative is item 48"],
  "fresh cream": [6, "GOODRICH CREAMY DELITE is the cream line"],
  milk: [47, "ANAND COW MILK"],
  "low-fat milk": [47, "same dairy line"],
  "whole wheat tortilla": [7, "WHOLEWHEAT WRAP 10 INCH — NOT item 96 TILL, which the substring matcher chose (torTILLa)"],
  tortilla: [71, "FRESH GO TORTILLA WRAP 10 PCS"],
  "multigrain tortilla": [95, "exact item"],
  "whole grain bread": [113, "BREAD JUMBO is the only bread line"],
  "high-fiber bread slices": [113, "same; sheet has one bread"],
  "bread slices": [113, "same"],
  "whole wheat bread": [113, "same"],
  bread: [113, "same"],
  "mozzarella cheese": [70, "PRABHAT MOZERALLA CHEESE; AMUL DICED (69) is the diced variant"],
  mozzarella: [70, "same"],
  "cheese slice": [16, "DAIRY CRAFT CHEESE SLICE"],
  cheese: [16, "bare 'cheese' → the slice line; mozzarella/feta/parmesan have their own keys"],
  "feta cheese": [17, "DAIRY CRAFT FETA CHEESE"],
  "parmesan cheese": [36, "exact item"],
  parmesan: [36, "same"],
  "hung curd": [82, "exact item"],
  curd: [118, "plain CURD line; HUNG CURD (82) is separate"],
  yogurt: [118, "kitchen's yogurt is the curd line"],
  "greek yogurt": [82, "hung curd is the Greek-style strained curd"],
  "olive oil": [68, "PAMOCE OLIVE OIL"],
  "extra virgin olive oil": [68, "same line"],
  oil: [32, "BEST CHOICE REFINED OIL is the default cooking oil"],
  "cooking oil": [32, "same"],
  honey: [97, "exact"],
  oats: [117, "exact"],
  spinach: [116, "exact"],
  paneer: [114, "exact"],
  potato: [76, "exact"],
  "mashed potato": [76, "preparation of raw POTATO; kitchen labour not costed here"],
  "potato wedges": [121, "the sheet carries a dedicated POTATO wedges line"],
  onion: [53, "exact"],
  onions: [53, "same"],
  "onion rings": [53, "preparation of the same item"],
  tomato: [56, "TOMATO LARGE is the standard tomato"],
  tomatoes: [56, "same"],
  "cherry tomatoes": [88, "CHERRY TOMATO"],
  lemon: [102, "exact"],
  "lemon juice": [102, "juiced from the LEMON line"],
  mint: [54, "exact"],
  "mint leaves": [54, "same"],
  "coriander leaves": [64, "inventory calls it CORIANDER GREEN"],
  coriander: [64, "same"],
  "curry leaves": [105, "exact"],
  basil: [10, "BASIL LEAVES (currently unpriced on the sheet — flows as 0-cost until priced)"],
  "basil leaves": [10, "same"],
  broccoli: [101, "inventory spells it BROCOLLI; FROZEN BROCCOLI (89) is the frozen line"],
  zucchini: [67, "exact; ZUCCINI YELLOW (57) is the yellow variant"],
  "bell peppers": [38, "GREEN BELL PEPPER as default; red 65 / yellow 66 exist"],
  "bell pepper": [38, "same"],
  cucumber: [42, "INDIAN CUCUMBER; ENGLISH (93) is the salad variant"],
  carrot: [107, "ORANGE CARROT as default; RED CARROT (103) exists"],
  carrots: [107, "same"],
  lettuce: [44, "LETTUCE ICEBERG; loose salad leaves are item 39"],
  "iceberg lettuce": [44, "exact"],
  quinoa: [34, "inventory spells it EASTMADE QUIONA"],
  "brown rice": [8, "DAWAAT BROWN RICE"],
  corn: [11, "FROZEN CORN CORN"],
  "sweet corn": [11, "same"],
  babycorn: [119, "exact"],
  hummus: [91, "exact"],
  pesto: [92, "PESTO SAUCE"],
  "basil pesto": [92, "same"],
  "bbq sauce": [90, "BARBEQUE SAUCE"],
  "barbeque sauce": [90, "exact"],
  "pasta sauce": [9, "CHEF CHOICE PIZZA PASTA SAUCE"],
  "pizza sauce": [9, "same"],
  marinara: [9, "same jar"],
  "tomato puree": [45, "sheet's TOMATO GRAVY line — confirm with kitchen it is the puree base"],
  mayonnaise: [25, "SALAD MAYONISE as default; chipotle 24 / tandoori 26 / eggless 72"],
  mayo: [25, "same"],
  "chipotle mayo": [24, "CHIPOTLE MAYONISSE"],
  "tandoori mayo": [26, "TANDOORI MAYONISSE"],
  "thousand island dressing": [74, "exact"],
  "dijon mustard": [120, "exact (currently unpriced)"],
  "peanut butter": [122, "exact (currently unpriced)"],
  garlic: [27, "GARLIC WHOLW"],
  ginger: [28, "exact"],
  "cumin powder": [98, "exact"],
  "cumin seeds": [23, "CUMIN SEED"],
  "mustard seeds": [22, "BLACK MUSTARD SEEDS"],
  oregano: [62, "OREGANO; FRUTIN (73) is the seasoning blend"],
  rosemary: [108, "exact"],
  "bay leaf": [49, "exact"],
  cinnamon: [50, "inventory calls it DALCHIINI"],
  "cinnamon powder": [50, "same"],
  "white pepper": [61, "exact"],
  "sesame seeds": [96, "inventory calls it TILL"],
  dates: [4, "SEEDLESS DATES"],
  pomegranate: [75, "inventory spells it POMEGRANTE"],
  watermelon: [46, "WATER MELON"],
  "orange juice": [58, "REAL ORANGE JUICE"],
  "tomato juice": [59, "REAL TOMATO JUICE"],
  apple: [51, "APPLE SHIMLA"],
  "green apple": [51, "same line; sheet stocks one apple"],
  banana: [100, "BANANA YELLOW"],
  celery: [41, "exact"],
  leeks: [43, "exact"],
  "french beans": [52, "exact"],
  "chana dal": [77, "exact"],
  chickpeas: [78, "KABULI CHANA"],
  "kabuli chana": [78, "exact"],
  "masoor dal": [79, "exact"],
  "arhar dal": [80, "exact"],
  "moong dal": [110, "exact"],
  rajma: [104, "RAJMA CHITRA"],
  poha: [86, "POHA MOTA"],
  atta: [94, "exact"],
  "wheat flour": [94, "ATTA"],
  maida: [33, "exact"],
  "corn flour": [19, "JEECON CORN FLOUR 5 KG"],
  cornstarch: [19, "same"],
  "cornstarch slurry": [19, "cornflour + water; only the flour costs"],
  panko: [60, "exact"],
  breadcrumbs: [60, "PANKO is the crumb line"],
  sugar: [35, "WHITE SUGAR"],
  "apple cider vinegar": [31, "inventory spells it VINGEGAR"],
  vinegar: [31, "the sheet's only vinegar is apple cider"],
  "chicken sausages": [20, "exact"],
  bacon: [21, "PORK BACON"],
  "baking powder": [13, "exact"],
  yeast: [30, "INSTANT DRY YEAST"],
  "activated charcoal powder": [115, "ACTIVATED CHARCOAL"],
  "blueberry crush": [14, "MALA CRUSH BLUEBERRY"],
  "mixed berries": [48, "DELISHH FROZEN MIX BERRIES"],
  "mojito syrup": [81, "BARISCO MOJITO SYRUP"],
  "watermelon syrup": [40, "WATERMELON BAR SYRUP"],
  "diet coke": [112, "ZERO CALORIE SODA"],
  "zero calorie soda": [112, "exact"],
  musambi: [55, "inventory spells it MUSAMI"],
  mosambi: [55, "same"],
  "button mushrooms": [87, "inventory spells it BUTTOM MUSHROOM"],
  "fresh mint": [54, "MINT"],
  olives: [5, "SLICED BLACK OLIVES"],
  "egg whites": [2, "portion of the EGG line; whole-egg price is the honest ceiling"],
  "poached egg": [2, "preparation of the same item"],
  "boiled chickpeas": [78, "cooked KABULI CHANA"],
  "moong sprouts": [110, "sprouted MOONG DAL"],
  capsicum: [38, "capsicum IS bell pepper in Indian English; green as default"],
  "flattened rice": [86, "flattened rice IS poha — POHA MOTA"],
  "whole wheat flour": [94, "ATTA is whole wheat flour"],
  butter: [109, "AMUL CHIPLETS are portioned butter"],
  "chicken strips": [1, "preparation of CHICKEN BREAST BONELESS"],
  "smoked chicken": [1, "same protein line"],
  "crispy peri peri chicken": [1, "same protein line, spiced"],
  "chicken tikka": [1, "marinated chicken breast; marinade not costed"],
  "paneer tikka": [114, "marinated PANEER; marinade not costed"],
  "crispy peri peri mushrooms": [87, "BUTTOM MUSHROOM, spiced"],
  "dates puree": [4, "SEEDLESS DATES, puréed"],
  "watermelon cubes": [46, "WATER MELON"],
  rice: [8, "menu bowls are brown-rice based; DAWAAT BROWN RICE — confirm"],
  pasta: [15, "default pasta line is WHOLE WHEAT PENNE — confirm"],
  "brown bread": [113, "one bread line on the sheet (BREAD JUMBO) — confirm variant"],
  "multigrain bread": [113, "same — confirm variant"],
  "white bread": [113, "same — confirm variant"],
  "romaine lettuce": [39, "LETTUCE GREEN SALAD LEAVES is the loose-leaf line — verify"],
  "diet coke can": [112, "ZERO CALORIE SODA"],
  "chipotle sauce": [24, "CHIPOTLE MAYONISSE is the chipotle line — verify"],
};

// Names that deliberately carry no inventory cost: negligible mass, water, or
// "to taste" seasoning lines. Recording the verdict is the point — a no-cost
// row is a decision on file, where the fuzzy matcher's silent miss was not.
const NO_COST: Record<string, string> = {
  "salt & pepper": "measured 'to taste' — negligible mass and cost",
  "salt and pepper": "same",
  "salt, pepper": "same",
  salt: "negligible cost at recipe quantities; LOW SALT line (29) exists if the kitchen wants it tracked",
  "light salt": "same as salt",
  "ice cubes": "frozen water",
  ice: "frozen water",
  water: "not an inventory good",
  "warm water": "not an inventory good",
  "salt & black pepper": "seasoning-scale quantities — negligible mass and cost",
  "salt & turmeric": "seasoning-scale quantities — negligible mass and cost",
};

// ── Scoring fallback for everything not curated ──────────────────────────────

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 2)
      .map((t) => t.replace(/s$/, "")),
  );
}

function scoreMatch(ingKey: string, product: string): number {
  const a = tokens(ingKey);
  const b = tokens(product);
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.max(a.size, b.size);
}

// ── Build ────────────────────────────────────────────────────────────────────

const keys = new Map<string, { uses: number; sample: string }>();
for (const d of sheet.dishes) {
  for (const raw of d.ingredients ?? []) {
    const p = parseSheetIngredient(raw);
    const e = keys.get(p.key) ?? { uses: 0, sample: raw };
    e.uses += 1;
    keys.set(p.key, e);
  }
}

// Preserve human-accepted rows from the existing CSV verbatim.
const accepted = new Map<string, MappingRow>();
if (existsSync(CSV_PATH)) {
  const prior = loadMapping(readFileSync(CSV_PATH, "utf8"), inventoryByNo);
  for (const err of prior.errors) console.error(`prior CSV: ${err}`);
  for (const [k, row] of prior.rows) if (row.status === "accepted") accepted.set(k, row);
}

const rows: MappingRow[] = [];
let nAlias = 0;
let nNoCost = 0;
let nScored = 0;
let nKitchen = 0;
for (const [key] of [...keys.entries()].sort((a, b) => b[1].uses - a[1].uses)) {
  const kept = accepted.get(key);
  if (kept) {
    rows.push(kept);
    continue;
  }
  const alias = ALIASES[key];
  if (alias) {
    const [itemNo, rationale] = alias;
    const product = inventoryByNo.get(itemNo);
    if (!product) throw new Error(`alias for "${key}" targets missing item_no ${itemNo}`);
    rows.push({ key, verdict: "map", itemNo, itemProduct: product, status: "proposed", rationale });
    nAlias += 1;
    continue;
  }
  const noCost = NO_COST[key];
  if (noCost) {
    rows.push({ key, verdict: "no-cost", itemNo: null, itemProduct: "", status: "proposed", rationale: noCost });
    nNoCost += 1;
    continue;
  }
  // Composite lines ("bell peppers & onion", "lettuce, cucumber, tomato") can
  // never auto-propose a single-item map: the scorer would pick ONE component
  // and silently drop the rest — the same under-weighting defect the fuzzy
  // cost matcher has. A human may still hand-map one by editing the CSV.
  if (/[&,]|\band\b/.test(key)) {
    rows.push({
      key,
      verdict: "kitchen",
      itemNo: null,
      itemProduct: "",
      status: "proposed",
      rationale: "composite line — split into components on the sheet, or hand-map deliberately",
    });
    nKitchen += 1;
    continue;
  }
  let best: { no: number; product: string; score: number } | null = null;
  for (const [no, product] of inventoryByNo) {
    const s = scoreMatch(key, product);
    if (s > (best?.score ?? 0)) best = { no, product, score: s };
  }
  if (best && best.score >= 0.6) {
    rows.push({
      key,
      verdict: "map",
      itemNo: best.no,
      itemProduct: best.product,
      status: "proposed",
      rationale: `token match ${(best.score * 100).toFixed(0)}% — verify`,
    });
    nScored += 1;
  } else {
    rows.push({
      key,
      verdict: "kitchen",
      itemNo: null,
      itemProduct: "",
      status: "proposed",
      rationale:
        best && best.score > 0
          ? `no confident match (best: "${best.product}" at ${(best.score * 100).toFixed(0)}%) — composite line, missing inventory row, or needs the kitchen`
          : "no inventory candidate — composite line, missing inventory row, or needs the kitchen",
    });
    nKitchen += 1;
  }
}

console.log(`distinct ingredient keys : ${keys.size}`);
console.log(`kept accepted rows       : ${accepted.size}`);
console.log(`proposed via alias       : ${nAlias}`);
console.log(`proposed no-cost         : ${nNoCost}`);
console.log(`proposed via token score : ${nScored}`);
console.log(`left for the kitchen     : ${nKitchen}`);

if (WRITE) {
  writeFileSync(CSV_PATH, serializeMapping(rows));
  console.log(`\nwrote ${rows.length} rows → ${CSV_PATH}`);
} else {
  console.log("\ndry-run — pass --write to update the CSV");
}
