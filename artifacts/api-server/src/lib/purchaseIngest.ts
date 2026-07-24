/**
 * Turn PetPooja supplier invoices into real ingredient costs.
 *
 * WHY: `inventory_items.buying_price_paise` / `per_kg_unit_paise` are the only
 * cost inputs we have, and today they come from a one-off spreadsheet seed
 * (`scripts/src/seed-ops-data.ts`). Every downstream number is built on them:
 *
 *   - `lib/menuEngineering.ts` prices each recipe from `per_kg_unit_paise`
 *     (falling back to a flat 35%-of-price margin when there is no recipe cost);
 *   - `lib/reorder.ts` values every recommended purchase line at
 *     `buying_price_paise` and groups the resulting POs by supplier.
 *
 * So a stale seed price silently produces a wrong margin and a wrong PO total.
 * PetPooja's Get Purchase API is the one capability their Inventory API does
 * expose that fixes this: actual invoiced quantities, rates and supplier names.
 *
 * WHAT THIS DOES NOT DO: it never invents inventory rows and never creates
 * kitchen-stock rows. It only corrects prices on SKUs we already track, and
 * fills in a supplier name where none was recorded. On-hand quantities are
 * Slice B (Get Stock); they are untouched here.
 *
 * Everything above `applyPurchaseIngest` is pure and unit-tested; only the
 * apply step touches the database.
 */

import { db, inventoryItemsTable, kitchenStockTable } from "@workspace/db";
import { and, eq, isNull, or } from "drizzle-orm";
import {
  fetchPurchases,
  petpoojaInventoryConfig,
  type FetchLike,
  type InventoryLogger,
  type PetpoojaPurchaseLine,
} from "./petpoojaInventory";

// ── Units ───────────────────────────────────────────────────────────────────

/**
 * Mass units only. Volume (ltr/ml) is deliberately NOT folded into kilograms:
 * density varies by ingredient (oil ≈ 0.92 kg/l, honey ≈ 1.42) and guessing
 * would corrupt the per-kg cost that recipe margins are computed from.
 */
const MASS_TO_KG: Record<string, number | undefined> = {
  kg: 1, kgs: 1, kilo: 1, kilos: 1, kilogram: 1, kilograms: 1,
  g: 0.001, gm: 0.001, gms: 0.001, gram: 0.001, grams: 0.001, grm: 0.001,
  mg: 0.000001,
};

const UNIT_ALIASES: Record<string, string | undefined> = {
  l: "ltr", ltr: "ltr", ltrs: "ltr", litre: "ltr", litres: "ltr", liter: "ltr", liters: "ltr",
  ml: "ml", millilitre: "ml", milliliter: "ml",
  pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs", nos: "pcs", no: "pcs", each: "pcs",
  pkt: "pkt", packet: "pkt", packets: "pkt", pack: "pkt",
  box: "box", boxes: "box", carton: "box",
  dozen: "dozen", dz: "dozen",
  bunch: "bunch", bundle: "bunch",
};

export interface CanonicalUnit {
  canonical: string;
  /** Kilograms in one unit, or null when the unit is not a mass unit. */
  kgPerUnit: number | null;
}

export function canonicalUnit(raw: string): CanonicalUnit {
  const u = raw.toLowerCase().replace(/[^a-z]/g, "");
  const kg = MASS_TO_KG[u];
  if (kg !== undefined) return { canonical: "kg", kgPerUnit: kg };
  return { canonical: UNIT_ALIASES[u] ?? (u || "unit"), kgPerUnit: null };
}

// ── Product-name normalization + matching ───────────────────────────────────

/** Match key: lowercase, drop bracketed qualifiers, collapse to bare words. */
export function normalizeProductName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsWhole(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${esc}( |$)`).test(haystack);
}

export interface MatchCandidate {
  id: number;
  product: string;
}

export type MatchResult =
  | { kind: "matched"; item: MatchCandidate }
  | { kind: "unmatched" }
  | { kind: "ambiguous"; candidates: string[] };

/**
 * Resolve a vendor product name to exactly one inventory SKU.
 *
 * Deliberately stricter than `menuEngineering.ts`'s read-side matcher (which
 * takes the FIRST loose substring hit): this path WRITES prices, and writing a
 * supplier's rate onto the wrong SKU is worse than not writing it at all. So an
 * ambiguous name is reported for a human rather than resolved by luck.
 */
export function matchInventoryItem(
  vendorProduct: string,
  inventory: MatchCandidate[],
): MatchResult {
  const key = normalizeProductName(vendorProduct);
  if (!key) return { kind: "unmatched" };

  const exact = inventory.filter((i) => normalizeProductName(i.product) === key);
  if (exact.length === 1) return { kind: "matched", item: exact[0] };
  if (exact.length > 1) {
    return { kind: "ambiguous", candidates: exact.map((i) => i.product) };
  }

  const partial = inventory.filter((i) => {
    const ik = normalizeProductName(i.product);
    return containsWhole(ik, key) || containsWhole(key, ik);
  });
  if (partial.length === 0) return { kind: "unmatched" };
  if (partial.length === 1) return { kind: "matched", item: partial[0] };

  // Several plausible SKUs and no exact hit — refuse rather than tie-break.
  // A generic invoice line ("Oil") against "Sunflower Oil" / "Mustard Oil" has
  // no correct automatic answer; a human adds the alias or renames the SKU.
  return { kind: "ambiguous", candidates: partial.map((i) => i.product) };
}

// ── Aggregation ─────────────────────────────────────────────────────────────

export interface AggregatedPurchase {
  productKey: string;
  /** Representative raw vendor spelling. */
  product: string;
  lineCount: number;
  totalPaise: number;
  /** Volume-weighted price per kilogram, when mass units were invoiced. */
  perKgPaise: number | null;
  /** Volume-weighted price for one `unit`. */
  unitPricePaise: number;
  unit: string;
  /** Supplier with the most spend on this product in the window. */
  supplierName: string | null;
  lastInvoiceDate: string | null;
}

/**
 * Collapse invoice lines to one weighted-average price per product.
 *
 * Weighted by quantity, not by line count: two lines of 1 kg @ ₹100 and 99 kg
 * @ ₹50 must land near ₹50, which is what we will actually pay next time.
 */
export function aggregatePurchaseLines(
  lines: PetpoojaPurchaseLine[],
): AggregatedPurchase[] {
  interface Acc {
    product: string;
    lineCount: number;
    totalPaise: number;
    massKg: number;
    massPaise: number;
    byUnit: Map<string, { qty: number; paise: number }>;
    supplierSpend: Map<string, number>;
    lastInvoiceDate: string | null;
  }
  const acc = new Map<string, Acc>();

  for (const line of lines) {
    const key = normalizeProductName(line.product);
    if (!key) continue;
    const entry: Acc = acc.get(key) ?? {
      product: line.product.trim(),
      lineCount: 0,
      totalPaise: 0,
      massKg: 0,
      massPaise: 0,
      byUnit: new Map(),
      supplierSpend: new Map(),
      lastInvoiceDate: null,
    };
    const { canonical, kgPerUnit } = canonicalUnit(line.unit);
    entry.lineCount += 1;
    entry.totalPaise += line.lineTotalPaise;
    if (kgPerUnit !== null) {
      entry.massKg += line.qty * kgPerUnit;
      entry.massPaise += line.lineTotalPaise;
    }
    const u = entry.byUnit.get(canonical) ?? { qty: 0, paise: 0 };
    u.qty += line.qty;
    u.paise += line.lineTotalPaise;
    entry.byUnit.set(canonical, u);

    if (line.supplierName) {
      entry.supplierSpend.set(
        line.supplierName,
        (entry.supplierSpend.get(line.supplierName) ?? 0) + line.lineTotalPaise,
      );
    }
    if (line.invoiceDate && (!entry.lastInvoiceDate || line.invoiceDate > entry.lastInvoiceDate)) {
      entry.lastInvoiceDate = line.invoiceDate;
    }
    acc.set(key, entry);
  }

  const out: AggregatedPurchase[] = [];
  for (const [productKey, e] of acc) {
    const perKgPaise = e.massKg > 0 ? Math.round(e.massPaise / e.massKg) : null;

    let unit = "kg";
    let unitPricePaise = perKgPaise ?? 0;
    if (perKgPaise === null) {
      // No mass lines — price against whichever unit carried the most spend.
      let bestUnit: string | null = null;
      let bestPaise = -1;
      for (const [u, v] of e.byUnit) {
        if (v.paise > bestPaise && v.qty > 0) {
          bestPaise = v.paise;
          bestUnit = u;
        }
      }
      if (bestUnit === null) continue;
      const v = e.byUnit.get(bestUnit)!;
      unit = bestUnit;
      unitPricePaise = Math.round(v.paise / v.qty);
    }
    if (unitPricePaise <= 0) continue;

    let supplierName: string | null = null;
    let topSpend = -1;
    for (const [s, spend] of e.supplierSpend) {
      if (spend > topSpend) {
        topSpend = spend;
        supplierName = s;
      }
    }

    out.push({
      productKey,
      product: e.product,
      lineCount: e.lineCount,
      totalPaise: e.totalPaise,
      perKgPaise,
      unitPricePaise,
      unit,
      supplierName,
      lastInvoiceDate: e.lastInvoiceDate,
    });
  }
  return out.sort((a, b) => b.totalPaise - a.totalPaise);
}

// ── Planning ────────────────────────────────────────────────────────────────

/**
 * A new price this many times above (or below) the recorded one is treated as a
 * unit mismatch — e.g. the vendor billed per gram where we store per kilo — and
 * is reported for review instead of written. Cheaper than silently rewriting
 * every menu margin off a decimal-place error.
 */
export const PRICE_SANITY_FACTOR = 10;

export interface PlannedUpdate {
  inventoryItemId: number;
  /** Our SKU name. */
  product: string;
  /** The vendor's spelling that matched it. */
  vendorProduct: string;
  buyingQty: string;
  buyingPricePaise: number;
  perKgUnitPaise: number | null;
  pricePer100GmPcsLabel: string | null;
  pricePer10GmLabel: string | null;
  supplierName: string | null;
  previousBuyingPricePaise: number | null;
  /** Percent change vs the previous price, rounded; null when there was none. */
  changePct: number | null;
}

export interface IngestPlan {
  updates: PlannedUpdate[];
  unmatched: Array<{ vendorProduct: string; totalPaise: number }>;
  ambiguous: Array<{ vendorProduct: string; candidates: string[] }>;
  suspicious: Array<{
    vendorProduct: string;
    product: string;
    previousPaise: number;
    proposedPaise: number;
  }>;
}

export interface InventoryRow {
  id: number;
  product: string;
  buyingPricePaise: number | null;
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/** Pure: decide what would change, given aggregates and the current SKU table. */
export function planPurchaseIngest(
  aggregates: AggregatedPurchase[],
  inventory: InventoryRow[],
): IngestPlan {
  const plan: IngestPlan = { updates: [], unmatched: [], ambiguous: [], suspicious: [] };
  const candidates: MatchCandidate[] = inventory.map((i) => ({ id: i.id, product: i.product }));
  const byId = new Map(inventory.map((i) => [i.id, i]));
  const claimed = new Set<number>();

  for (const agg of aggregates) {
    const match = matchInventoryItem(agg.product, candidates);
    if (match.kind === "unmatched") {
      plan.unmatched.push({ vendorProduct: agg.product, totalPaise: agg.totalPaise });
      continue;
    }
    if (match.kind === "ambiguous") {
      plan.ambiguous.push({ vendorProduct: agg.product, candidates: match.candidates });
      continue;
    }
    // Aggregates are ordered by spend, so if two vendor names collapse onto one
    // SKU the higher-spend one wins and the other is surfaced, not silently lost.
    if (claimed.has(match.item.id)) {
      plan.ambiguous.push({ vendorProduct: agg.product, candidates: [match.item.product] });
      continue;
    }

    const row = byId.get(match.item.id);
    const previous = row?.buyingPricePaise ?? null;
    if (
      previous !== null &&
      previous > 0 &&
      (agg.unitPricePaise > previous * PRICE_SANITY_FACTOR ||
        agg.unitPricePaise * PRICE_SANITY_FACTOR < previous)
    ) {
      plan.suspicious.push({
        vendorProduct: agg.product,
        product: match.item.product,
        previousPaise: previous,
        proposedPaise: agg.unitPricePaise,
      });
      continue;
    }

    claimed.add(match.item.id);
    plan.updates.push({
      inventoryItemId: match.item.id,
      product: match.item.product,
      vendorProduct: agg.product,
      buyingQty: `1 ${agg.unit}`,
      buyingPricePaise: agg.unitPricePaise,
      perKgUnitPaise: agg.perKgPaise,
      pricePer100GmPcsLabel:
        agg.perKgPaise !== null
          ? `${rupees(agg.perKgPaise / 10)} / 100 gm`
          : `${rupees(agg.unitPricePaise)} / ${agg.unit}`,
      pricePer10GmLabel:
        agg.perKgPaise !== null ? `${rupees(agg.perKgPaise / 100)} / 10 gm` : null,
      supplierName: agg.supplierName,
      previousBuyingPricePaise: previous,
      changePct:
        previous !== null && previous > 0
          ? Math.round(((agg.unitPricePaise - previous) / previous) * 100)
          : null,
    });
  }
  return plan;
}

// ── Apply (the only DB-touching step) ───────────────────────────────────────

export interface ApplyResult {
  itemsUpdated: number;
  suppliersFilled: number;
}

/**
 * Write the plan. Idempotent: re-running over the same invoice window recomputes
 * the same weighted averages and writes the same values, so duplicate ticks
 * (e.g. two Cloud Run replicas) converge rather than compound.
 */
export async function applyPurchaseIngest(plan: IngestPlan): Promise<ApplyResult> {
  let itemsUpdated = 0;
  let suppliersFilled = 0;

  for (const u of plan.updates) {
    await db
      .update(inventoryItemsTable)
      .set({
        buyingQty: u.buyingQty,
        buyingPricePaise: u.buyingPricePaise,
        perKgUnitPaise: u.perKgUnitPaise,
        pricePer100GmPcsLabel: u.pricePer100GmPcsLabel,
        pricePer10GmLabel: u.pricePer10GmLabel,
      })
      .where(eq(inventoryItemsTable.id, u.inventoryItemId));
    itemsUpdated += 1;

    // Fill a missing supplier only. An ops-curated supplier is left alone: the
    // invoice tells us who we bought from last, not who we should buy from.
    if (u.supplierName) {
      const res = await db
        .update(kitchenStockTable)
        .set({ supplierName: u.supplierName })
        .where(
          and(
            eq(kitchenStockTable.inventoryItemId, u.inventoryItemId),
            or(
              isNull(kitchenStockTable.supplierName),
              eq(kitchenStockTable.supplierName, ""),
            ),
          ),
        )
        .returning({ id: kitchenStockTable.id });
      suppliersFilled += res.length;
    }
  }
  return { itemsUpdated, suppliersFilled };
}

// ── Orchestration ───────────────────────────────────────────────────────────

/**
 * The review-shaped projection of a `PlannedUpdate`. The full record carries the
 * derived display labels too, which are noise when the question is "did this
 * price come out right?" — so the log gets the before, the after, the move
 * between them, and who we bought it from.
 */
export interface PlannedPriceLogEntry {
  product: string;
  vendorProduct: string;
  previousPaise: number | null;
  newPaise: number;
  changePct: number | null;
  supplierName: string | null;
}

/** See `PLANNED_LOG_LIMIT` in stockSync.ts — same reasoning, kept in step. */
export const PLANNED_LOG_LIMIT = 100;

export interface PurchaseIngestSummary {
  ok: boolean;
  /** True when PetPooja Inventory is unconfigured — a no-op, not a failure. */
  skipped?: boolean;
  dryRun: boolean;
  range: { startDate: string; endDate: string };
  linesFetched: number;
  productsAggregated: number;
  itemsUpdated: number;
  suppliersFilled: number;
  /**
   * The price changes themselves, capped at `PLANNED_LOG_LIMIT`. A dry run that
   * reports only `itemsUpdated: 0` cannot be reviewed, and these prices feed
   * margin — so they are worth reading before they land, and worth having on
   * record after.
   */
  planned: PlannedPriceLogEntry[];
  /** Length of the full plan, whether or not `planned` was truncated. */
  plannedTotal: number;
  unmatched: string[];
  ambiguous: string[];
  suspicious: IngestPlan["suspicious"];
  error?: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function purchaseWindow(now: Date, lookbackDays: number): { startDate: string; endDate: string } {
  const start = new Date(now.getTime() - Math.max(lookbackDays, 0) * 24 * 3600 * 1000);
  return { startDate: isoDay(start), endDate: isoDay(now) };
}

export async function runPurchaseIngest(
  opts: {
    lookbackDays?: number;
    now?: Date;
    dryRun?: boolean;
    fetchImpl?: FetchLike;
    log?: InventoryLogger;
  } = {},
): Promise<PurchaseIngestSummary> {
  const dryRun = opts.dryRun ?? false;
  const range = purchaseWindow(opts.now ?? new Date(), opts.lookbackDays ?? 7);
  const empty: PurchaseIngestSummary = {
    ok: false,
    dryRun,
    range,
    linesFetched: 0,
    productsAggregated: 0,
    itemsUpdated: 0,
    suppliersFilled: 0,
    planned: [],
    plannedTotal: 0,
    unmatched: [],
    ambiguous: [],
    suspicious: [],
  };

  if (!petpoojaInventoryConfig()) return { ...empty, skipped: true };

  const fetched = await fetchPurchases(range, {
    fetchImpl: opts.fetchImpl,
    log: opts.log,
  });
  if (!fetched.ok) return { ...empty, error: fetched.error };

  const aggregates = aggregatePurchaseLines(fetched.lines);
  const inventory = await db
    .select({
      id: inventoryItemsTable.id,
      product: inventoryItemsTable.product,
      buyingPricePaise: inventoryItemsTable.buyingPricePaise,
    })
    .from(inventoryItemsTable);

  const plan = planPurchaseIngest(aggregates, inventory);
  const applied = dryRun
    ? { itemsUpdated: 0, suppliersFilled: 0 }
    : await applyPurchaseIngest(plan);

  const summary: PurchaseIngestSummary = {
    ok: true,
    dryRun,
    range,
    linesFetched: fetched.lines.length,
    productsAggregated: aggregates.length,
    itemsUpdated: applied.itemsUpdated,
    suppliersFilled: applied.suppliersFilled,
    planned: plan.updates.slice(0, PLANNED_LOG_LIMIT).map((u) => ({
      product: u.product,
      vendorProduct: u.vendorProduct,
      previousPaise: u.previousBuyingPricePaise,
      newPaise: u.buyingPricePaise,
      changePct: u.changePct,
      supplierName: u.supplierName,
    })),
    plannedTotal: plan.updates.length,
    unmatched: plan.unmatched.map((u) => u.vendorProduct),
    ambiguous: plan.ambiguous.map((a) => a.vendorProduct),
    suspicious: plan.suspicious,
  };
  if (dryRun) {
    // See the matching branch in stockSync.ts — a dry run needs reading, and
    // info-level in a production log stream does not get read.
    opts.log?.warn?.(summary, "petpooja purchase ingest DRY RUN — nothing written, review `planned`");
  } else {
    opts.log?.info?.(summary, "petpooja purchase ingest complete");
  }
  return summary;
}
