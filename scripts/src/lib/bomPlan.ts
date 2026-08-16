/**
 * BOM backfill plan engine — pure and DB-free, in the mould of
 * menuCatalogV2Plan.ts. Derives the desired `dish_bom_components` rows for
 * every dish on the RD master sheet, through a REVIEWED ingredient→inventory
 * mapping, and reports everything it refuses to derive and why.
 *
 * WHY THIS EXISTS. `dish_bom_components` is the structured ingredient model —
 * explicit inventory FK, numeric quantity, normalised unit — and it has three
 * production readers (bomEngine's depletion + prep brief + PO drafting,
 * marginGuardrailEngine's spike tracing) and, until this engine, no writer of
 * any kind. Meanwhile the free-text costing path resolves 77 of 198
 * ingredient names and reads 371 of 667 quantity rows as zero grams. See
 * docs/TNM-MENU-01/BOM-ADOPTION.md for the full record.
 *
 * DESIGN RULES, each one a blocker from that document:
 *  - Slug fence (blocker 2): a sheet dish maps to a catalog slug by exact
 *    name, falling back to the seed's normalised join only when that key is
 *    unambiguous. A dish that matches nothing, or matches a COLLIDING key
 *    (the "(Veg)"/"(Chicken)" families — see resolveCatalogSlug), is BLOCKED
 *    and reported. This engine contains no slugify().
 *  - Reviewed mapping (blockers 3, 4): every ingredient name resolves through
 *    scripts/data/bom-ingredient-map.csv. A name with no row, or whose row a
 *    human has not flipped to `accepted`, leaves its dish INCOMPLETE — and an
 *    incomplete dish emits NO rows at all, because a partial BOM is a
 *    silently understated cost, which is the defect being fixed.
 *  - Grams only (blocker 6): quantities normalise to grams at authoring time
 *    via the kitchen's own measurement tables (gramsFromQuantityText). The
 *    runtime never converts volumes; rows land in the DB already weighed.
 *  - Serving basis (blocker 5): quantities are per ONE sellable unit, i.e.
 *    the sheet's serving size. Each dish's servingSize string is carried into
 *    the plan so the kitchen can veto the assumption dish by dish.
 */
import {
  DISHES,
  gramsFromQuantityText,
  normalizeName,
} from "@workspace/menu-catalog";

// ── Sheet shapes (the subset this engine reads) ──────────────────────────────

export interface SheetDishInput {
  name: string;
  servingSize?: string;
  ingredients?: string[];
}

export interface SheetInventoryInput {
  no: string;
  product: string;
}

// ── Mapping CSV ──────────────────────────────────────────────────────────────

export type MapVerdict = "map" | "no-cost" | "kitchen";
export type MapStatus = "proposed" | "accepted";

export interface MappingRow {
  /** normalizeName() of the ingredient as it appears on the sheet */
  key: string;
  verdict: MapVerdict;
  /** inventory item_no when verdict is `map` */
  itemNo: number | null;
  /** redundant copy of the product name, verified against the sheet at load */
  itemProduct: string;
  status: MapStatus;
  rationale: string;
}

const CSV_HEADER =
  "ingredient_key,verdict,item_no,item_product,status,rationale";

/** Minimal CSV field escaping — quote when the value contains , or ". */
export function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function serializeMapping(rows: MappingRow[]): string {
  const body = rows
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) =>
      [
        csvField(r.key),
        r.verdict,
        r.itemNo == null ? "" : String(r.itemNo),
        csvField(r.itemProduct),
        r.status,
        csvField(r.rationale),
      ].join(","),
    );
  return [CSV_HEADER, ...body].join("\n") + "\n";
}

export interface MappingLoad {
  rows: Map<string, MappingRow>;
  errors: string[];
}

/**
 * Parse and validate the mapping CSV. Structural problems are ERRORS (the
 * caller must refuse to plan on a malformed control file); review-state
 * problems (proposed rows) are the plan's job to report, not this loader's.
 */
export function loadMapping(
  csv: string,
  inventoryByNo: Map<number, string>,
): MappingLoad {
  const errors: string[] = [];
  const rows = new Map<string, MappingRow>();
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines[0]?.trim() !== CSV_HEADER) {
    errors.push(
      `mapping CSV header must be exactly "${CSV_HEADER}" (got "${lines[0] ?? ""}")`,
    );
    return { rows, errors };
  }
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    if (f.length !== 6) {
      errors.push(`malformed row (${f.length} fields): ${line}`);
      continue;
    }
    const [key, verdict, itemNoRaw, itemProduct, status, rationale] = f as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (verdict !== "map" && verdict !== "no-cost" && verdict !== "kitchen") {
      errors.push(`row "${key}": unknown verdict "${verdict}"`);
      continue;
    }
    if (status !== "proposed" && status !== "accepted") {
      errors.push(`row "${key}": unknown status "${status}"`);
      continue;
    }
    let itemNo: number | null = null;
    if (verdict === "map") {
      itemNo = Number(itemNoRaw);
      if (!Number.isInteger(itemNo)) {
        errors.push(`row "${key}": verdict map but item_no "${itemNoRaw}" is not an integer`);
        continue;
      }
      const product = inventoryByNo.get(itemNo);
      if (product == null) {
        errors.push(`row "${key}": item_no ${itemNo} not on the inventory sheet`);
        continue;
      }
      // The redundant product column is the drift alarm: if the sheet's row
      // for this item_no no longer says what the reviewer saw, the mapping
      // must be re-reviewed, not silently retargeted.
      if (product.trim().toLowerCase() !== itemProduct.trim().toLowerCase()) {
        errors.push(
          `row "${key}": item_no ${itemNo} is now "${product}" on the sheet but the mapping was reviewed against "${itemProduct}"`,
        );
        continue;
      }
    }
    if (rows.has(key)) {
      errors.push(`duplicate mapping row for "${key}"`);
      continue;
    }
    rows.set(key, { key, verdict, itemNo, itemProduct, status, rationale });
  }
  return { rows, errors };
}

// ── Ingredient parsing ───────────────────────────────────────────────────────

export interface ParsedSheetIngredient {
  raw: string;
  /** normalizeName() output — the mapping key. First option of "a / b". */
  key: string;
  /** the discarded alternative when the raw name was "a / b" (blocker 3) */
  alternative: string | null;
  grams: number;
}

/** Split "Name – Qty (note)" exactly the way seed-ops-data.ts does. */
export function parseSheetIngredient(raw: string): ParsedSheetIngredient {
  const parts = raw.split(/\s[–—-]\s/);
  const namePart = (parts[0] ?? raw).trim();
  const qtyPart = parts.length >= 2 ? parts.slice(1).join(" - ").trim() : null;
  const key = normalizeName(namePart);
  const alternatives = namePart
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*\/\s*/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return {
    raw,
    key,
    alternative: alternatives.length > 1 ? alternatives.slice(1).join(" / ") : null,
    grams: gramsFromQuantityText(qtyPart ?? namePart, key),
  };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

export interface PlannedBomRow {
  itemNo: number;
  product: string;
  grams: number;
  /** the sheet lines this row aggregates (duplicate items sum) */
  from: string[];
}

export interface DishPlan {
  sheetName: string;
  slug: string | null;
  servingSize: string | null;
  status:
    | "ready"
    | "incomplete"
    | "blocked-no-slug"
    | "blocked-ambiguous-slug"
    | "no-ingredients";
  rows: PlannedBomRow[];
  /** ingredient lines resolved to a deliberate no-cost verdict */
  noCost: string[];
  /** lines whose mapping is missing, unaccepted, or verdict `kitchen` */
  unresolved: Array<{ raw: string; key: string; reason: string }>;
  /** "a / b" ingredient lines where the first option was taken (blocker 3) */
  compoundAssumptions: Array<{ raw: string; took: string; dropped: string }>;
  /** mapped lines whose quantity parsed to zero grams — a mapped-but-weightless
   *  row would write quantityNeeded=0, so it blocks readiness instead */
  zeroGram: string[];
}

export interface BomPlan {
  dishes: DishPlan[];
  ready: DishPlan[];
  stats: {
    sheetDishes: number;
    ready: number;
    incomplete: number;
    blockedNoSlug: number;
    blockedAmbiguous: number;
    noIngredients: number;
    plannedRows: number;
    distinctItemsUsed: number;
  };
}

/**
 * Sheet name → catalog slug, and the reason when there is no answer.
 *
 * TWO-STAGE, and the order is the whole point. `normNameLikeSeed` strips
 * parentheticals, which is exactly what distinguishes several real dish
 * FAMILIES: "Pesto Pasta (Veg)" / "(Chicken)" / "(Prawns)" all normalise to
 * "pesto pasta", as do the Hot n Sour and Manchow soup pairs — 7 catalog
 * dishes collapsing onto 3 keys. A `new Map(...)` over those keys silently
 * keeps the LAST writer, so a single-stage normalised join would hand the
 * veg soup's ingredients to the chicken soup's slug. On a table that drives
 * inventory depletion and allergen-adjacent costing, that is not a rounding
 * error.
 *
 * So: exact name first (the sheet and the catalog spell these identically,
 * parenthetical included), and the normalised join only as a fallback and
 * only when it is UNAMBIGUOUS. An ambiguous key returns no slug and blocks
 * the dish.
 *
 * DELIBERATE DIVERGENCE FROM seed-ops-data.ts. That script does the
 * single-stage `new Map(DISHES.map(d => [normName(d.name), d]))` join and
 * therefore has this bug today: within each colliding family one sheet dish
 * takes the other's slug and the next takes it again with a `-x` suffix
 * appended by its dedupe loop. Reproducing that for consistency's sake would
 * mean knowingly writing wrong slugs, so this diverges and the recipes-side
 * defect is recorded in docs/TNM-MENU-01/BOM-ADOPTION.md instead.
 */
export function resolveCatalogSlug(sheetName: string): {
  slug: string | null;
  ambiguous: boolean;
} {
  const exact = new Map<string, string>();
  for (const d of DISHES) exact.set(d.name.toLowerCase().replace(/\s+/g, " ").trim(), d.slug);
  const hit = exact.get(sheetName.toLowerCase().replace(/\s+/g, " ").trim());
  if (hit) return { slug: hit, ambiguous: false };

  const byNorm = new Map<string, Set<string>>();
  for (const d of DISHES) {
    const k = normNameLikeSeed(d.name);
    const set = byNorm.get(k) ?? new Set<string>();
    set.add(d.slug);
    byNorm.set(k, set);
  }
  const candidates = byNorm.get(normNameLikeSeed(sheetName));
  if (!candidates || candidates.size === 0) return { slug: null, ambiguous: false };
  if (candidates.size > 1) return { slug: null, ambiguous: true };
  return { slug: [...candidates][0]!, ambiguous: false };
}

export function buildBomPlan(input: {
  dishes: SheetDishInput[];
  inventoryByNo: Map<number, string>;
  mapping: Map<string, MappingRow>;
}): BomPlan {
  const dishes: DishPlan[] = input.dishes.map((dish) => {
    const resolved = resolveCatalogSlug(dish.name);
    const slug = resolved.slug;
    const servingSize = dish.servingSize?.trim() || null;
    const ingredients = dish.ingredients ?? [];
    if (ingredients.length === 0) {
      return {
        sheetName: dish.name,
        slug,
        servingSize,
        status: resolved.ambiguous
          ? "blocked-ambiguous-slug"
          : "no-ingredients",
        rows: [],
        noCost: [],
        unresolved: [],
        compoundAssumptions: [],
        zeroGram: [],
      };
    }

    const byItem = new Map<number, PlannedBomRow>();
    const noCost: string[] = [];
    const unresolved: DishPlan["unresolved"] = [];
    const compoundAssumptions: DishPlan["compoundAssumptions"] = [];
    const zeroGram: string[] = [];

    for (const raw of ingredients) {
      const parsed = parseSheetIngredient(raw);
      if (parsed.alternative) {
        compoundAssumptions.push({
          raw,
          took: parsed.key,
          dropped: parsed.alternative,
        });
      }
      const m = input.mapping.get(parsed.key);
      if (!m) {
        unresolved.push({ raw, key: parsed.key, reason: "no mapping row" });
        continue;
      }
      if (m.status !== "accepted") {
        unresolved.push({ raw, key: parsed.key, reason: `mapping still ${m.status}` });
        continue;
      }
      if (m.verdict === "no-cost") {
        noCost.push(raw);
        continue;
      }
      if (m.verdict === "kitchen") {
        unresolved.push({ raw, key: parsed.key, reason: "verdict kitchen — needs the kitchen" });
        continue;
      }
      // verdict === "map"
      if (parsed.grams <= 0) {
        zeroGram.push(raw);
        continue;
      }
      const itemNo = m.itemNo!;
      const existing = byItem.get(itemNo);
      if (existing) {
        existing.grams += parsed.grams;
        existing.from.push(raw);
      } else {
        byItem.set(itemNo, {
          itemNo,
          product: input.inventoryByNo.get(itemNo) ?? m.itemProduct,
          grams: parsed.grams,
          from: [raw],
        });
      }
    }

    const rows = [...byItem.values()].sort((a, b) => a.itemNo - b.itemNo);
    const status: DishPlan["status"] =
      resolved.ambiguous
        ? "blocked-ambiguous-slug"
        : slug == null
        ? "blocked-no-slug"
        : unresolved.length > 0 || zeroGram.length > 0
          ? "incomplete"
          : "ready";
    return {
      sheetName: dish.name,
      slug,
      servingSize,
      status,
      rows,
      noCost,
      unresolved,
      compoundAssumptions,
      zeroGram,
    };
  });

  const ready = dishes.filter((d) => d.status === "ready");
  const itemsUsed = new Set(ready.flatMap((d) => d.rows.map((r) => r.itemNo)));
  return {
    dishes,
    ready,
    stats: {
      sheetDishes: dishes.length,
      ready: ready.length,
      incomplete: dishes.filter((d) => d.status === "incomplete").length,
      blockedNoSlug: dishes.filter((d) => d.status === "blocked-no-slug").length,
      blockedAmbiguous: dishes.filter((d) => d.status === "blocked-ambiguous-slug").length,
      noIngredients: dishes.filter((d) => d.status === "no-ingredients").length,
      plannedRows: ready.reduce((n, d) => n + d.rows.length, 0),
      distinctItemsUsed: itemsUsed.size,
    },
  };
}

/**
 * seed-ops-data.ts's normName, duplicated deliberately and pinned by test:
 * the slug join MUST be the same join the recipes seed uses, or the BOM and
 * the recipes table would disagree about which sheet dish a slug means.
 */
export function normNameLikeSeed(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(o\)/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
