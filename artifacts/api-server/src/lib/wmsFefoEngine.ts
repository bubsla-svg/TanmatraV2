/**
 * Tanmatra Marketplace WMS & FEFO Inventory Engine.
 * Enforces 1:1 CPG SKU deductions across ordered expiration lots (First-Expired, First-Out)
 * without polluting kitchen BOM recipe components. Also executes nightly 14-day expiry
 * liquidation sweeps to project flash discounts into storefront deal feeds.
 */
import { eq, and, gt, lte, asc, sql } from "drizzle-orm";
import { db, marketplaceBatchesTable, marketplaceItemsTable } from "@workspace/db";
import { logger } from "./logger";

export interface FefoDeductionLine {
  itemId: number;
  qtyRequired: number;
}

export interface FefoAllocationResult {
  itemId: number;
  batchId: number;
  batchNumber: string;
  qtyDeducted: number;
  remainingBatchQty: number;
}

export class FefoStockoutError extends Error {
  constructor(public itemId: number, public required: number, public available: number) {
    super(`FEFO Stockout for item ${itemId}: required ${required}, but only ${available} unexpired units remain across active lots.`);
    this.name = "FefoStockoutError";
  }
}

/**
 * Execute an atomic FEFO decrement across a list of marketplace cart items.
 */
export async function executeFefoDeduction(
  lines: FefoDeductionLine[],
): Promise<FefoAllocationResult[]> {
  const allocations: FefoAllocationResult[] = [];
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const line of lines) {
      let remainingToDeduct = line.qtyRequired;

      // 1. Acquire row-level locks on unexpired lots sorted by oldest expiry date first
      const availableBatches = await tx
        .select()
        .from(marketplaceBatchesTable)
        .where(
          and(
            eq(marketplaceBatchesTable.inventoryItemId, line.itemId),
            gt(marketplaceBatchesTable.currentQty, 0),
            gt(marketplaceBatchesTable.expiryDate, now),
          ),
        )
        .orderBy(asc(marketplaceBatchesTable.expiryDate))
        .for("update");

      const totalAvailable = availableBatches.reduce((acc, b) => acc + b.currentQty, 0);
      if (totalAvailable < remainingToDeduct) {
        throw new FefoStockoutError(line.itemId, line.qtyRequired, totalAvailable);
      }

      // 2. Roll over deductions sequentially across older lot boundaries
      for (const batch of availableBatches) {
        if (remainingToDeduct <= 0) break;

        const deductFromBatch = Math.min(batch.currentQty, remainingToDeduct);
        const newBatchQty = batch.currentQty - deductFromBatch;

        await tx
          .update(marketplaceBatchesTable)
          .set({ currentQty: newBatchQty })
          .where(eq(marketplaceBatchesTable.id, batch.id));

        remainingToDeduct -= deductFromBatch;

        allocations.push({
          itemId: line.itemId,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          qtyDeducted: deductFromBatch,
          remainingBatchQty: newBatchQty,
        });
      }

      // 3. Synchronize aggregated parent inventory count for Storefront catalog queries
      await tx
        .update(marketplaceItemsTable)
        .set({
          stockQty: sql`greatest(0, ${marketplaceItemsTable.stockQty} - ${line.qtyRequired})`,
        })
        .where(eq(marketplaceItemsTable.id, line.itemId));
    }
  });

  logger.info({ allocationsCount: allocations.length }, "marketplace.fefo.deductions_committed");
  return allocations;
}

export interface LiquidationDealPayload {
  slug: string;
  skuName: string;
  originalPricePaise: number;
  discountedPricePaise: number;
  discountPercentage: number;
  batchNumber: string;
  expiryDate: string;
  promotionalBadge: string;
  unitsAvailable: number;
}

let activeLiquidationDeals: Map<string, LiquidationDealPayload> = new Map();

/**
 * Execute nightly liquidation sweep for items expiring within 14 days.
 */
export async function executeNightlyExpirySweep(): Promise<LiquidationDealPayload[]> {
  const now = new Date();
  const warningCutoff = new Date(Date.now() + 14 * 24 * 3600_000);

  const expiringBatches = await db
    .select({
      batch: marketplaceBatchesTable,
      item: marketplaceItemsTable,
    })
    .from(marketplaceBatchesTable)
    .innerJoin(marketplaceItemsTable, eq(marketplaceBatchesTable.inventoryItemId, marketplaceItemsTable.id))
    .where(
      and(
        gt(marketplaceBatchesTable.currentQty, 0),
        gt(marketplaceBatchesTable.expiryDate, now),
        lte(marketplaceBatchesTable.expiryDate, warningCutoff),
      ),
    );

  const freshDeals: Map<string, LiquidationDealPayload> = new Map();

  for (const { batch, item } of expiringBatches) {
    const daysRemaining = Math.ceil((batch.expiryDate.getTime() - now.getTime()) / (24 * 3600_000));

    logger.warn(
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        itemId: item.id,
        slug: item.slug,
        currentQty: batch.currentQty,
        daysRemaining,
        expiryDate: batch.expiryDate.toISOString().slice(0, 10),
      },
      "marketplace.fefo.expiry_liquidation_warning",
    );

    const discountPct = daysRemaining <= 5 ? 40 : 30;
    const discountedPrice = Math.round(item.pricePaise * (1 - discountPct / 100));

    freshDeals.set(item.slug, {
      slug: item.slug,
      skuName: item.name,
      originalPricePaise: item.pricePaise,
      discountedPricePaise: discountedPrice,
      discountPercentage: discountPct,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate.toISOString().slice(0, 10),
      promotionalBadge: `⚡ Flash Liquidation: Best Before ${batch.expiryDate.toISOString().slice(0, 10)} (${discountPct}% OFF)`,
      unitsAvailable: batch.currentQty,
    });
  }

  activeLiquidationDeals = freshDeals;
  logger.info({ totalLiquidationDeals: freshDeals.size }, "marketplace.fefo.liquidation_deals_hydrated");

  return Array.from(freshDeals.values());
}

/**
 * Accessor hook for Storefront deal feeds and public deals endpoints.
 */
export function getActiveLiquidationDeals(): LiquidationDealPayload[] {
  return Array.from(activeLiquidationDeals.values());
}
