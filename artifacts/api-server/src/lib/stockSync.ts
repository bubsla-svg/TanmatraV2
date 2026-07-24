/**
 * Pull PetPooja's on-hand balances into `kitchen_stock.on_hand_qty`.
 *
 * WHY: `lib/reorder.ts` decides what to buy with
 *
 *     lte(kitchenStockTable.onHandQty, kitchenStockTable.parLevel)
 *
 * and today nothing keeps `on_hand_qty` current — it is whatever the seed put
 * there or whatever ops last typed in. So the reorder engine is reasoning about
 * a stock level that may be months stale, in both directions: it recommends
 * buying things we have, and stays silent on things we ran out of.
 *
 * PetPooja support confirmed there is no stock-threshold webhook; Get Stock
 * ("stock levels for a given date") is the offered alternative, so this is a
 * poll rather than a push.
 *
 * ── The central hazard ─────────────────────────────────────────────────────
 * That `lte` compares **in the row's own unit**. `par_level` for a row whose
 * `unit` is "kg" means kilograms; if the vendor reports the same ingredient in
 * grams and we write 500 into a kg row, the engine concludes we hold 500 kg and
 * the kitchen runs out silently. Every write here therefore converts into the
 * EXISTING row's unit or refuses the item outright. `unit` itself is never
 * rewritten — changing it would silently reinterpret `par_level` and
 * `reorder_qty`, which this sync has no business touching.
 *
 * WHAT THIS DOES NOT DO: it never inserts `kitchen_stock` rows, never creates
 * inventory SKUs, never touches `par_level` / `reorder_qty` / `supplier_*`, and
 * never writes prices (that is `purchaseIngest.ts`).
 *
 * Everything above `applyStockSync` is pure and unit-tested; only the apply step
 * touches the database.
 */

import { db, inventoryItemsTable, kitchenStockTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  fetchStock,
  petpoojaInventoryConfig,
  type FetchLike,
  type InventoryLogger,
  type PetpoojaStockLine,
} from "./petpoojaInventory";
import {
  canonicalUnit,
  matchInventoryItem,
  type MatchCandidate,
} from "./purchaseIngest";

// ── Units ───────────────────────────────────────────────────────────────────

/**
 * Volume units, keyed by the canonical form `canonicalUnit` produces. Kept
 * local (and separate from `purchaseIngest`'s mass table) for the same reason
 * that one refuses volume→mass: density varies by ingredient, so the two
 * families convert within themselves and never across.
 */
const VOLUME_TO_L: Record<string, number | undefined> = { ltr: 1, ml: 0.001 };

/**
 * Convert a vendor quantity into the unit a `kitchen_stock` row is denominated
 * in, or return null when the conversion is not provably safe.
 *
 * Allowed: mass↔mass, volume↔volume, and identical canonical units (pcs→pcs,
 * pkt→pkt, …).
 *
 * Deliberately refused:
 *   - anything crossing families (kg↔ltr, pcs↔kg) — density and pack size are
 *     per-ingredient facts we do not hold;
 *   - dozen→pcs, despite the arithmetic being "obvious". Indian suppliers use
 *     "dozen" as a pack label rather than a count of 12 (an egg tray is 30), so
 *     multiplying by 12 would be a guess dressed up as a conversion;
 *   - a blank vendor unit against any real unit. Refusing makes the gap visible
 *     in the ops report; assuming makes it invisible and 1000× wrong.
 */
export function convertQty(qty: number, fromRaw: string, toRaw: string): number | null {
  if (!Number.isFinite(qty)) return null;
  const from = canonicalUnit(fromRaw);
  const to = canonicalUnit(toRaw);

  if (from.kgPerUnit !== null && to.kgPerUnit !== null) {
    if (to.kgPerUnit <= 0) return null;
    return (qty * from.kgPerUnit) / to.kgPerUnit;
  }

  const fromL = VOLUME_TO_L[from.canonical];
  const toL = VOLUME_TO_L[to.canonical];
  if (fromL !== undefined && toL !== undefined) {
    if (toL <= 0) return null;
    return (qty * fromL) / toL;
  }

  if (from.canonical === to.canonical) return qty;
  return null;
}

// ── Plan ────────────────────────────────────────────────────────────────────

/** The `kitchen_stock` columns this sync reads. Kept narrow so planning is pure. */
export interface StockRow {
  id: number;
  inventoryItemId: number;
  zone: string;
  onHandQty: number;
  unit: string;
}

export interface PlannedStockUpdate {
  stockId: number;
  inventoryItemId: number;
  /** Vendor spelling(s) that produced this balance, for the ops log. */
  vendorProduct: string;
  zone: string;
  /** The row's existing unit. Never changed — only reported. */
  unit: string;
  previousQty: number;
  newQty: number;
}

export interface StockPlan {
  updates: PlannedStockUpdate[];
  /** Vendor products we do not stock. Never auto-created. */
  unmatched: { vendorProduct: string; qty: number; unit: string }[];
  /**
   * Refused rather than guessed. `"name"` = the vendor name fits several SKUs;
   * `"zone"` = the SKU is stocked in several zones and the vendor returns one
   * outlet-wide number, so writing it everywhere would multiply-count.
   */
  ambiguous: { vendorProduct: string; reason: "name" | "zone"; detail: string[] }[];
  /** Vendor unit could not be converted into the row's unit. See `convertQty`. */
  unitMismatch: { vendorProduct: string; vendorUnit: string; rowUnit: string; qty: number }[];
  /** Matched SKU with no `kitchen_stock` row. Ops must create it; we do not. */
  noStockRow: { vendorProduct: string; inventoryItemId: number; qty: number; unit: string }[];
  /** Rows already holding the vendor's number — no write issued. */
  unchanged: number;
  /** Present when the whole batch was refused by the zero-flood breaker. */
  aborted?: { reason: "zero_flood"; zeroWrites: number; plannedWrites: number };
  /**
   * The writes the breaker took away, kept for the ops log. Only `updates` is
   * ever applied, so these cannot leak into the database — but a bare count of
   * what was refused leaves nothing to diagnose with, and the one recovery that
   * is always wrong (raise the ratio until it passes) is then the only one
   * available. Seeing the actual SKUs is what distinguishes "the feed is broken"
   * from "the kitchen really did run down".
   */
  refused?: PlannedStockUpdate[];
}

/** Float noise floor for "did this actually change?" on a doublePrecision column. */
const EPSILON = 1e-6;

/**
 * Zero-flood circuit breaker. If more than this share of the writes we are about
 * to issue would replace a non-zero balance with zero, we refuse the entire
 * batch.
 *
 * The failure it exists for: an outlet that does not actually maintain inventory
 * in PetPooja returns 0 for everything. Applied naively that empties
 * `on_hand_qty` across the board, and `reorder.ts` — whose whole trigger is
 * `on_hand <= par` — then recommends repurchasing the entire pantry. Losing a
 * day of freshness is recoverable; a bogus outlet-wide PO is not.
 */
export const DEFAULT_MAX_ZERO_RATIO = 0.5;
/** Below this many writes the ratio is noise, so the breaker stays out of the way. */
const MIN_SAMPLE = 5;

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Decide what to write. Pure: no DB, no clock, no network.
 *
 * Several vendor rows can land on one SKU (batch-level rows, or spelling
 * variants that all resolve to the same item); their quantities are SUMMED,
 * because an on-hand balance is additive and taking one row would understate
 * what we hold. Summing is safe against nested responses because the parser is
 * line-first: an object that reads as a stock row is emitted and not recursed
 * into, so a total and its constituent rows never both appear.
 */
export function planStockSync(
  lines: PetpoojaStockLine[],
  inventory: MatchCandidate[],
  stockRows: StockRow[],
  opts: { maxZeroRatio?: number } = {},
): StockPlan {
  const plan: StockPlan = {
    updates: [],
    unmatched: [],
    ambiguous: [],
    unitMismatch: [],
    noStockRow: [],
    unchanged: 0,
  };

  // 1. Resolve every vendor row to at most one SKU.
  const byItem = new Map<number, { itemId: number; lines: PetpoojaStockLine[] }>();
  for (const line of lines) {
    const m = matchInventoryItem(line.product, inventory);
    if (m.kind === "unmatched") {
      plan.unmatched.push({ vendorProduct: line.product, qty: line.qty, unit: line.unit });
      continue;
    }
    if (m.kind === "ambiguous") {
      plan.ambiguous.push({
        vendorProduct: line.product,
        reason: "name",
        detail: m.candidates,
      });
      continue;
    }
    const bucket = byItem.get(m.item.id);
    if (bucket) bucket.lines.push(line);
    else byItem.set(m.item.id, { itemId: m.item.id, lines: [line] });
  }

  // 2. Index the stock rows we may write.
  const rowsByItem = new Map<number, StockRow[]>();
  for (const row of stockRows) {
    const list = rowsByItem.get(row.inventoryItemId);
    if (list) list.push(row);
    else rowsByItem.set(row.inventoryItemId, [row]);
  }

  // 3. One decision per SKU.
  for (const group of byItem.values()) {
    const rows = rowsByItem.get(group.itemId) ?? [];
    const names = group.lines.map((l) => l.product);
    const label = names[0] ?? "";

    if (rows.length === 0) {
      for (const l of group.lines) {
        plan.noStockRow.push({
          vendorProduct: l.product,
          inventoryItemId: group.itemId,
          qty: l.qty,
          unit: l.unit,
        });
      }
      continue;
    }

    if (rows.length > 1) {
      // The vendor gives one outlet-wide number. Writing it into every zone row
      // would report the same stock N times over; splitting it would be an
      // invention. Ops resolves this by consolidating zones or by telling us
      // which one PetPooja actually mirrors.
      plan.ambiguous.push({
        vendorProduct: label,
        reason: "zone",
        detail: rows.map((r) => r.zone),
      });
      continue;
    }

    const row = rows[0];

    // All-or-nothing conversion: a partial sum understates on-hand, and an
    // understated on-hand is exactly what makes `reorder.ts` buy things twice.
    let total = 0;
    let bad = false;
    for (const l of group.lines) {
      const converted = convertQty(l.qty, l.unit, row.unit);
      if (converted === null) {
        plan.unitMismatch.push({
          vendorProduct: l.product,
          vendorUnit: l.unit,
          rowUnit: row.unit,
          qty: l.qty,
        });
        bad = true;
        continue;
      }
      total += converted;
    }
    if (bad) continue;

    const newQty = round6(total);
    if (Math.abs(newQty - row.onHandQty) <= EPSILON) {
      plan.unchanged += 1;
      continue;
    }

    plan.updates.push({
      stockId: row.id,
      inventoryItemId: group.itemId,
      vendorProduct: names.length > 1 ? names.join(" + ") : label,
      zone: row.zone,
      unit: row.unit,
      previousQty: row.onHandQty,
      newQty,
    });
  }

  // 4. Zero-flood breaker.
  const maxZeroRatio = opts.maxZeroRatio ?? DEFAULT_MAX_ZERO_RATIO;
  const zeroWrites = plan.updates.filter(
    (u) => u.newQty <= EPSILON && u.previousQty > EPSILON,
  ).length;
  if (
    plan.updates.length >= MIN_SAMPLE &&
    zeroWrites / plan.updates.length > maxZeroRatio
  ) {
    plan.aborted = { reason: "zero_flood", zeroWrites, plannedWrites: plan.updates.length };
    plan.refused = plan.updates;
    plan.updates = [];
  }

  return plan;
}

// ── Apply (the only DB-touching step) ───────────────────────────────────────

export interface StockApplyResult {
  rowsUpdated: number;
}

/**
 * Write the plan. Idempotent: the next tick recomputes the same balances from
 * the same feed and finds them `unchanged`, so duplicate ticks (two Cloud Run
 * replicas) converge rather than compound. Addressed by `stockId`, so it can
 * only ever touch rows the plan actually resolved.
 */
export async function applyStockSync(plan: StockPlan): Promise<StockApplyResult> {
  let rowsUpdated = 0;
  for (const u of plan.updates) {
    await db
      .update(kitchenStockTable)
      .set({ onHandQty: u.newQty })
      .where(eq(kitchenStockTable.id, u.stockId));
    rowsUpdated += 1;
  }
  return { rowsUpdated };
}

// ── Orchestration ───────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

/**
 * The outlet's calendar day, not UTC's. Get Stock takes a date, and at 02:00 IST
 * `toISOString()` still says yesterday — which would ask for a balance a full
 * service day stale.
 */
export function istDay(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * How many planned writes ride along in the log line. The dry run exists to be
 * read, so this is generous; it is bounded at all because a large outlet's whole
 * catalogue would blow the log entry, and a dropped log line reviews as badly as
 * no log line. `plannedTotal` always carries the real count, so a truncated
 * sample can never be mistaken for the complete plan.
 */
export const PLANNED_LOG_LIMIT = 100;

export interface StockSyncSummary {
  ok: boolean;
  /** True when PetPooja Inventory is unconfigured — a no-op, not a failure. */
  skipped?: boolean;
  dryRun: boolean;
  date: string;
  rowsFetched: number;
  rowsUpdated: number;
  unchanged: number;
  /**
   * The writes themselves, capped at `PLANNED_LOG_LIMIT`. Without this a dry run
   * reports `rowsUpdated: 0` and nothing else, which cannot answer the only
   * question it was run to answer — is the vendor telling us what we think it
   * is? Present on live runs too, where it doubles as the audit trail for a
   * column no human edits.
   */
  planned: PlannedStockUpdate[];
  /** Length of the full plan, whether or not `planned` was truncated. */
  plannedTotal: number;
  unmatched: string[];
  ambiguous: StockPlan["ambiguous"];
  unitMismatch: StockPlan["unitMismatch"];
  noStockRow: string[];
  aborted?: StockPlan["aborted"];
  /** Sample of what the breaker refused, same cap. See `StockPlan.refused`. */
  refused?: PlannedStockUpdate[];
  error?: string;
}

export async function runStockSync(
  opts: {
    date?: string;
    now?: Date;
    dryRun?: boolean;
    maxZeroRatio?: number;
    fetchImpl?: FetchLike;
    log?: InventoryLogger;
  } = {},
): Promise<StockSyncSummary> {
  const dryRun = opts.dryRun ?? false;
  const date = opts.date ?? istDay(opts.now ?? new Date());
  const empty: StockSyncSummary = {
    ok: false,
    dryRun,
    date,
    rowsFetched: 0,
    rowsUpdated: 0,
    unchanged: 0,
    planned: [],
    plannedTotal: 0,
    unmatched: [],
    ambiguous: [],
    unitMismatch: [],
    noStockRow: [],
  };

  if (!petpoojaInventoryConfig()) return { ...empty, skipped: true };

  const fetched = await fetchStock(date, { fetchImpl: opts.fetchImpl, log: opts.log });
  if (!fetched.ok) return { ...empty, error: fetched.error };

  const inventory = await db
    .select({ id: inventoryItemsTable.id, product: inventoryItemsTable.product })
    .from(inventoryItemsTable);
  const stockRows = await db
    .select({
      id: kitchenStockTable.id,
      inventoryItemId: kitchenStockTable.inventoryItemId,
      zone: kitchenStockTable.zone,
      onHandQty: kitchenStockTable.onHandQty,
      unit: kitchenStockTable.unit,
    })
    .from(kitchenStockTable);

  const plan = planStockSync(fetched.lines, inventory, stockRows, {
    maxZeroRatio: opts.maxZeroRatio,
  });
  const applied = dryRun ? { rowsUpdated: 0 } : await applyStockSync(plan);

  const summary: StockSyncSummary = {
    ok: true,
    dryRun,
    date,
    rowsFetched: fetched.lines.length,
    rowsUpdated: applied.rowsUpdated,
    unchanged: plan.unchanged,
    planned: plan.updates.slice(0, PLANNED_LOG_LIMIT),
    plannedTotal: plan.updates.length,
    unmatched: plan.unmatched.map((u) => u.vendorProduct),
    ambiguous: plan.ambiguous,
    unitMismatch: plan.unitMismatch,
    noStockRow: plan.noStockRow.map((n) => n.vendorProduct),
    ...(plan.aborted ? { aborted: plan.aborted } : {}),
    ...(plan.refused ? { refused: plan.refused.slice(0, PLANNED_LOG_LIMIT) } : {}),
  };
  if (plan.aborted) {
    opts.log?.error?.(summary, "petpooja stock sync REFUSED — zero-flood guard tripped");
  } else if (dryRun) {
    // A dry run is a run waiting on a person. info is where that waits unread,
    // so it goes out at warn, next to the other things needing a decision.
    opts.log?.warn?.(summary, "petpooja stock sync DRY RUN — nothing written, review `planned`");
  } else {
    opts.log?.info?.(summary, "petpooja stock sync complete");
  }
  return summary;
}
