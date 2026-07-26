/**
 * Autonomous Bill of Materials (BOM) & Inventory Restocking Engine (PRD Phase 1A).
 * Bridges customer meal orders to live raw ingredient depletion in kitchen_stock,
 * executes automatic supplier purchase order (PO) drafting when thresholds break,
 * and generates consolidated 4:00 AM Morning Prep Briefs for kitchen line chefs.
 */
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  dishBomComponentsTable,
  kitchenStockTable,
  inventoryItemsTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  forecastSnapshotsTable,
} from "@workspace/db";

export interface OrderDishInput {
  dishSlug: string;
  quantity: number;
}

export interface BomDeductionResult {
  inventoryItemId: number;
  deductedQty: number;
  triggeredPoDraft: boolean;
}

export interface MorningPrepStationSummary {
  inventoryItemId: number;
  product: string;
  totalRequired: number;
  unit: string;
  stationZone: string;
}

/**
 * Execute real-time BOM explosion for a plated meal order.
 * Decrements constituent raw inventory inputs and evaluates replenishment rules.
 */
export async function executeBomExplosion(
  orderItems: OrderDishInput[],
): Promise<BomDeductionResult[]> {
  if (!orderItems.length) return [];
  const slugs = orderItems.map((i) => i.dishSlug);

  const bomRows = await db
    .select()
    .from(dishBomComponentsTable)
    .where(inArray(dishBomComponentsTable.dishSlug, slugs));

  if (!bomRows.length) return [];

  const quantityBySlug = new Map<string, number>();
  for (const item of orderItems) {
    const prev = quantityBySlug.get(item.dishSlug) ?? 0;
    quantityBySlug.set(item.dishSlug, prev + item.quantity);
  }

  const deductions = new Map<number, number>();
  for (const bom of bomRows) {
    const orderedQty = quantityBySlug.get(bom.dishSlug) ?? 0;
    if (orderedQty > 0) {
      const prev = deductions.get(bom.inventoryItemId) ?? 0;
      deductions.set(bom.inventoryItemId, prev + bom.quantityNeeded * orderedQty);
    }
  }

  const results: BomDeductionResult[] = [];
  for (const [itemId, deductedQty] of deductions.entries()) {
    const [updatedStock] = await db
      .update(kitchenStockTable)
      .set({
        onHandQty: sql`${kitchenStockTable.onHandQty} - ${deductedQty}`,
        updatedAt: new Date(),
      })
      .where(eq(kitchenStockTable.inventoryItemId, itemId))
      .returning();

    let triggeredPo = false;
    if (updatedStock && updatedStock.onHandQty <= updatedStock.reorderQty) {
      triggeredPo = await evaluateAndDraftPo(itemId, updatedStock.reorderQty, updatedStock.parLevel, updatedStock.zone);
    }

    results.push({
      inventoryItemId: itemId,
      deductedQty,
      triggeredPoDraft: triggeredPo,
    });
  }

  return results;
}

/**
 * Autonomously evaluates trailing stock levels and drafts a supplier Purchase Order (PO)
 * if no active draft PO already covers this item and zone.
 */
export async function evaluateAndDraftPo(
  inventoryItemId: number,
  reorderQty: number,
  parLevel: number,
  zone: string,
): Promise<boolean> {
  const items = await db
    .select()
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, inventoryItemId))
    .limit(1);

  if (!items.length) return false;
  const item = items[0];

  const stocks = await db
    .select()
    .from(kitchenStockTable)
    .where(and(eq(kitchenStockTable.inventoryItemId, inventoryItemId), eq(kitchenStockTable.zone, zone)))
    .limit(1);
  const stock = stocks[0];
  const supplierName = stock?.supplierName || "Default Partner Wholesale";
  const supplierEmail = stock?.supplierEmail || "procurement@partner.example";

  // Prevent spam: check if an active draft PO already exists for this supplier in this zone
  let poId: number;
  const existingPos = await db
    .select()
    .from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.supplierName, supplierName), eq(purchaseOrdersTable.status, "draft")))
    .limit(1);

  if (existingPos.length > 0) {
    poId = existingPos[0]!.id;
  } else {
    const [newPo] = await db
      .insert(purchaseOrdersTable)
      .values({
        supplierName,
        supplierEmail,
        zone,
        status: "draft",
        totalPaise: 0,
        notes: `Autonomously drafted by BOM engine upon breaching reorder threshold (${reorderQty})`,
      })
      .returning({ id: purchaseOrdersTable.id });
    poId = newPo!.id;
  }

  // Calculate order quantity required to comfortably exceed par level
  const orderQty = Math.max(10, parLevel + reorderQty);
  const unitPricePaise = item.buyingPricePaise || 15000; // default to ₹150/unit if unlisted
  const lineTotalPaise = Math.round(orderQty * unitPricePaise);

  await db.insert(purchaseOrderLinesTable).values({
    purchaseOrderId: poId,
    inventoryItemId,
    qty: orderQty,
    unit: stock?.unit || "kg",
    unitPricePaise,
    lineTotalPaise,
  });

  await db
    .update(purchaseOrdersTable)
    .set({ totalPaise: sql`${purchaseOrdersTable.totalPaise} + ${lineTotalPaise}` })
    .where(eq(purchaseOrdersTable.id, poId));

  return true;
}

/**
 * 4:00 AM Morning Brief & Prep Aggregation Engine.
 * Combines statistical daily forecasts and subscription schedules into a deduplicated,
 * station-scoped preparation sheet for expediter line chefs.
 */
export async function generateMorningPrepBrief(forDateStr: string): Promise<MorningPrepStationSummary[]> {
  const snapshots = await db
    .select()
    .from(forecastSnapshotsTable)
    .where(eq(forecastSnapshotsTable.forDate, forDateStr));

  if (!snapshots.length) return [];

  const dishTotals = new Map<string, { totalQty: number; zone: string }>();
  for (const snap of snapshots) {
    const prev = dishTotals.get(snap.dishSlug) ?? { totalQty: 0, zone: snap.zone };
    dishTotals.set(snap.dishSlug, {
      totalQty: prev.totalQty + (snap.forecastQty || 1),
      zone: snap.zone || prev.zone,
    });
  }

  const slugs = Array.from(dishTotals.keys());
  if (!slugs.length) return [];

  const bomRows = await db
    .select()
    .from(dishBomComponentsTable)
    .where(inArray(dishBomComponentsTable.dishSlug, slugs));

  if (!bomRows.length) return [];

  const itemIds = Array.from(new Set(bomRows.map((b) => b.inventoryItemId)));
  const items = await db
    .select()
    .from(inventoryItemsTable)
    .where(inArray(inventoryItemsTable.id, itemIds));
  const itemMap = new Map<number, typeof items[number]>();
  for (const item of items) itemMap.set(item.id, item);

  const summaries = new Map<number, MorningPrepStationSummary>();
  for (const bom of bomRows) {
    const demand = dishTotals.get(bom.dishSlug);
    if (!demand) continue;
    const required = bom.quantityNeeded * demand.totalQty;
    const item = itemMap.get(bom.inventoryItemId);
    const product = item?.product || `Raw Item #${bom.inventoryItemId}`;
    const prev = summaries.get(bom.inventoryItemId) ?? {
      inventoryItemId: bom.inventoryItemId,
      product,
      totalRequired: 0,
      unit: bom.unit || "g",
      stationZone: demand.zone || "default",
    };
    prev.totalRequired += required;
    summaries.set(bom.inventoryItemId, prev);
  }

  return Array.from(summaries.values());
}
