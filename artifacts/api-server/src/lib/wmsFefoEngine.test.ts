/**
 * Integration unit test suite for Retail WMS FEFO Atomic Deductions,
 * Expiry Liquidation Sweeps, and Hybrid Checkout KDS Bypass routing.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  marketplaceItemsTable,
  marketplaceBatchesTable,
} from "@workspace/db";
import { executeFefoDeduction, executeNightlyExpirySweep, FefoStockoutError } from "./wmsFefoEngine";
import { classifyAndRouteBasket } from "./wmsRoutingEngine";

let testItemId: number;
let batchIdOld: number;
let batchIdNew: number;

before(async () => {
  const [item] = await db
    .insert(marketplaceItemsTable)
    .values({
      slug: `fefo-test-snack-${Math.random().toString(36).substring(2, 6)}`,
      name: "Test Functional Magnesium Bar",
      category: "snacks",
      pricePaise: 20000,
      stockQty: 25,
      isActive: true,
    })
    .returning({ id: marketplaceItemsTable.id });
  testItemId = item!.id;

  // Oldest lot: expires in 8 days (within 14-day liquidation sweep window), qty = 5
  const time8Days = new Date(Date.now() + 8 * 24 * 3600_000);
  const [b1] = await db
    .insert(marketplaceBatchesTable)
    .values({
      inventoryItemId: testItemId,
      batchNumber: "LOT_OLD_001",
      expiryDate: time8Days,
      currentQty: 5,
    })
    .returning({ id: marketplaceBatchesTable.id });
  batchIdOld = b1!.id;

  // Newer lot: expires in 60 days, qty = 20
  const time60Days = new Date(Date.now() + 60 * 24 * 3600_000);
  const [b2] = await db
    .insert(marketplaceBatchesTable)
    .values({
      inventoryItemId: testItemId,
      batchNumber: "LOT_NEW_002",
      expiryDate: time60Days,
      currentQty: 20,
    })
    .returning({ id: marketplaceBatchesTable.id });
  batchIdNew = b2!.id;
});

after(async () => {
  if (testItemId) {
    await db.delete(marketplaceBatchesTable).where(eq(marketplaceBatchesTable.inventoryItemId, testItemId)).catch(() => {});
    await db.delete(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, testItemId)).catch(() => {});
  }
});

test("executeFefoDeduction drains oldest unexpired lot first and rolls remaining deduction over to newer lots", async () => {
  // Deduct 8 units total: should drain LOT_OLD_001 (5 units) to 0, then take 3 units from LOT_NEW_002
  const results = await executeFefoDeduction([{ itemId: testItemId, qtyRequired: 8 }]);
  
  assert.equal(results.length, 2, "Should span across two lot boundaries");
  assert.equal(results[0]?.batchNumber, "LOT_OLD_001", "First deduction must target oldest expiring lot");
  assert.equal(results[0]?.qtyDeducted, 5);
  assert.equal(results[0]?.remainingBatchQty, 0);

  assert.equal(results[1]?.batchNumber, "LOT_NEW_002", "Second deduction rolls over into next lot");
  assert.equal(results[1]?.qtyDeducted, 3);
  assert.equal(results[1]?.remainingBatchQty, 17);

  // Verify updated database stock quantities
  const [updatedItem] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, testItemId));
  assert.equal(updatedItem?.stockQty, 17);
});

test("executeNightlyExpirySweep flags lots within 14-day window and generates flash liquidation deals", async () => {
  // Re-inject 4 units into old lot to verify sweep detection
  await db.update(marketplaceBatchesTable).set({ currentQty: 4 }).where(eq(marketplaceBatchesTable.id, batchIdOld));

  const deals = await executeNightlyExpirySweep();
  const testDeal = deals.find((d) => d.batchNumber === "LOT_OLD_001");
  
  assert.ok(testDeal, "Should generate a liquidation deal for LOT_OLD_001 expiring in 8 days");
  assert.equal(testDeal.originalPricePaise, 20000);
  assert.equal(testDeal.discountPercentage, 30);
  assert.equal(testDeal.discountedPricePaise, 14000);
  assert.ok(testDeal.promotionalBadge.includes("⚡ Flash Liquidation"));
});

test("classifyAndRouteBasket cleanly separates MTO hot kitchen lines from FMCG pantry expediter desks", () => {
  // Pure MTO Meal
  const mtoRes = classifyAndRouteBasket(101, "ext_101", [{ name: "Quinoa Bowl", qty: 2, fulfillmentType: "MTO" }]);
  assert.equal(mtoRes.routingMode, "PURE_MTO_KITCHEN");
  assert.equal(mtoRes.destinationQueue, "petpooja_kds");

  // Pure FMCG CPG item (KDS Bypass)
  const fmcgRes = classifyAndRouteBasket(102, "ext_102", [{ itemId: testItemId, name: "Magnesium Bar", qty: 4, fulfillmentType: "FMCG" }]);
  assert.equal(fmcgRes.routingMode, "PURE_FMCG_BYPASS");
  assert.equal(fmcgRes.destinationQueue, "3pl_fulfillment_desk");
  assert.equal(fmcgRes.hotKitchenLines.length, 0);

  // Mixed Basket
  const mixedRes = classifyAndRouteBasket(103, "ext_103", [
    { name: "Metabolic Curry", qty: 1, fulfillmentType: "MTO" },
    { itemId: testItemId, name: "Magnesium Bar", qty: 2, fulfillmentType: "FMCG" },
  ]);
  assert.equal(mixedRes.routingMode, "MIXED_HYBRID_SPLIT");
  assert.equal(mixedRes.destinationQueue, "dual_route");
  assert.equal(mixedRes.hotKitchenLines.length, 1);
  assert.equal(mixedRes.pantryExpediterLines.length, 1);
});
