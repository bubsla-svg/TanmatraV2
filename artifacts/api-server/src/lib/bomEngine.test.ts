/**
 * Integration unit test suite for Autonomous Bill of Materials (BOM) & Restocking Engine.
 * Verifies real-time KDS raw stock deductions, automated supplier PO generation,
 * and 4:00 AM Morning Prep Brief calculations against a Postgres test database.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  kitchenStockTable,
  dishBomComponentsTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  forecastSnapshotsTable,
} from "@workspace/db";
import { executeBomExplosion, evaluateAndDraftPo, generateMorningPrepBrief } from "./bomEngine";

let testItemId1: number;
let testItemId2: number;

before(async () => {
  const [item1] = await db
    .insert(inventoryItemsTable)
    .values({
      itemNo: 9901,
      product: "Test Organic Quinoa",
      buyingQty: "25kg Bag",
      buyingPricePaise: 20000,
    })
    .returning({ id: inventoryItemsTable.id });
  testItemId1 = item1!.id;

  const [item2] = await db
    .insert(inventoryItemsTable)
    .values({
      itemNo: 9902,
      product: "Test Cold-Pressed Olive Oil",
      buyingQty: "10L Can",
      buyingPricePaise: 18000,
    })
    .returning({ id: inventoryItemsTable.id });
  testItemId2 = item2!.id;

  // Insert initial store kitchen stock (on_hand_qty: 100g and 500ml)
  await db.insert(kitchenStockTable).values([
    {
      inventoryItemId: testItemId1,
      zone: "grains_station",
      onHandQty: 50, // Low initial stock to test reorder threshold breach
      unit: "g",
      parLevel: 200,
      reorderQty: 40,
      supplierName: "Organic Grains Co",
      supplierEmail: "orders@grains.test",
    },
    {
      inventoryItemId: testItemId2,
      zone: "garde_manger",
      onHandQty: 1000,
      unit: "ml",
      parLevel: 5000,
      reorderQty: 500,
      supplierName: "Artisan Oils Co",
      supplierEmail: "orders@oils.test",
    },
  ]);

  // Insert BOM rules for test hero dish "hp-quinoa-bowl-test"
  await db.insert(dishBomComponentsTable).values([
    {
      dishSlug: "hp-quinoa-bowl-test",
      inventoryItemId: testItemId1,
      quantityNeeded: 20, // 20g Quinoa per bowl
      unit: "g",
    },
    {
      dishSlug: "hp-quinoa-bowl-test",
      inventoryItemId: testItemId2,
      quantityNeeded: 15, // 15ml Olive Oil per bowl
      unit: "ml",
    },
  ]);

  // Insert test forecast snapshot for morning prep
  await db.insert(forecastSnapshotsTable).values({
    forDate: "2026-07-25",
    daypart: "lunch",
    zone: "grains_station",
    dishSlug: "hp-quinoa-bowl-test",
    forecastQty: 10,
  });
});

after(async () => {
  if (testItemId1 || testItemId2) {
    const ids = [testItemId1, testItemId2].filter(Boolean);
    await db.delete(purchaseOrderLinesTable).where(inArray(purchaseOrderLinesTable.inventoryItemId, ids)).catch(() => {});
    await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.supplierName, "Organic Grains Co")).catch(() => {});
    await db.delete(dishBomComponentsTable).where(inArray(dishBomComponentsTable.inventoryItemId, ids)).catch(() => {});
    await db.delete(kitchenStockTable).where(inArray(kitchenStockTable.inventoryItemId, ids)).catch(() => {});
    await db.delete(inventoryItemsTable).where(inArray(inventoryItemsTable.id, ids)).catch(() => {});
  }
  await db.delete(forecastSnapshotsTable).where(eq(forecastSnapshotsTable.dishSlug, "hp-quinoa-bowl-test")).catch(() => {});
});

test("executeBomExplodsion decrements raw stock and triggers automated supplier PO when reorder breached", async () => {
  // Order 2 bowls -> requires 40g quinoa and 30ml olive oil
  // Quinoa goes from 50g down to 10g, breaching reorderQty (40g) -> triggers PO!
  const results = await executeBomExplosion([{ dishSlug: "hp-quinoa-bowl-test", quantity: 2 }]);
  assert.equal(results.length, 2);

  const quinoaRes = results.find((r) => r.inventoryItemId === testItemId1);
  assert.ok(quinoaRes);
  assert.equal(quinoaRes.deductedQty, 40);
  assert.equal(quinoaRes.triggeredPoDraft, true, "Should automatically draft supplier PO when quinoa drops below reorder threshold");

  // Verify PO row created in Postgres
  const pos = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.supplierName, "Organic Grains Co"));
  assert.ok(pos.length >= 1);
  assert.equal(pos[0]!.status, "draft");
  assert.ok(pos[0]!.totalPaise > 0);
});

test("generateMorningPrepBrief correctly aggregates required raw volume for line chef stations", async () => {
  const brief = await generateMorningPrepBrief("2026-07-25");
  const quinoaStation = brief.find((b) => b.inventoryItemId === testItemId1);
  assert.ok(quinoaStation);
  assert.equal(quinoaStation.product, "Test Organic Quinoa");
  assert.equal(quinoaStation.totalRequired, 200); // 10 forecasted bowls * 20g
  assert.equal(quinoaStation.stationZone, "grains_station");
});
