/**
 * Integration unit test suite for Phase 3 Financial & Clinical Guardrails:
 * verified wholesale inventory cost spike BOM traversal + menu pricing suggestions,
 * and automated wearable biometric glucose target calibration & RD ingredient lockouts.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  inventoryItemsTable,
  dishBomComponentsTable,
  menuItemsTable,
  pricingSuggestionsTable,
  usersTable,
  dailyTargetsTable,
  rdClientSummariesTable,
} from "@workspace/db";
import { evaluateWholesalePriceSpike } from "./marginGuardrailEngine";
import { processBiometricAnomaly, getPatientIngredientLockouts } from "./clinicalGuardrailEngine";

let testItemId: number;
let testUserId: string;
const TEST_DISH_SLUG = "guardrail-test-bowl";

before(async () => {
  testUserId = `gr_usr_${Math.random().toString(36).substring(2, 8)}`;
  await db.insert(usersTable).values({ id: testUserId });

  // Insert test inventory item (baseline buyingPricePaise: ₹100 = 10000 paise)
  const [item] = await db
    .insert(inventoryItemsTable)
    .values({
      itemNo: 9988,
      product: "Test Hemp Seeds Wholesale",
      buyingQty: "5kg Bag",
      buyingPricePaise: 10000,
    })
    .returning({ id: inventoryItemsTable.id });
  testItemId = item!.id;

  // Insert test menu item and bind BOM rule
  await db.insert(menuItemsTable).values({
    slug: TEST_DISH_SLUG,
    name: "Test Hemp Super Bowl",
    pricePaise: 25000,
    category: "bowls",
  }).catch(() => {});

  await db.insert(dishBomComponentsTable).values({
    dishSlug: TEST_DISH_SLUG,
    inventoryItemId: testItemId,
    quantityNeeded: 30,
    unit: "g",
  }).catch(() => {});

  // Insert initial daily targets for test user
  await db.insert(dailyTargetsTable).values({
    userId: testUserId,
    calorieTarget: 2100,
    proteinTargetGrams: 85,
    fiberTargetGrams: 28,
  }).catch(() => {});
});

after(async () => {
  if (testItemId) {
    await db.delete(pricingSuggestionsTable).where(eq(pricingSuggestionsTable.slug, TEST_DISH_SLUG)).catch(() => {});
    await db.delete(dishBomComponentsTable).where(eq(dishBomComponentsTable.inventoryItemId, testItemId)).catch(() => {});
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, testItemId)).catch(() => {});
  }
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, TEST_DISH_SLUG)).catch(() => {});
  if (testUserId) {
    await db.delete(rdClientSummariesTable).where(eq(rdClientSummariesTable.userId, testUserId)).catch(() => {});
    await db.delete(dailyTargetsTable).where(eq(dailyTargetsTable.userId, testUserId)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, testUserId)).catch(() => {});
  }
});

test("evaluateWholesalePriceSpike triggers menu pricing proposals when cost increases by >=15%", async () => {
  // Minor spike (10500 vs 10000 = 5%): should NOT trigger proposal
  const minorRes = await evaluateWholesalePriceSpike(testItemId, 10500);
  assert.ok(minorRes);
  assert.equal(minorRes.spikePercent, 5);
  assert.equal(minorRes.pricingSuggestionsCreated, 0);

  // Severe spike (12500 vs 10500 = ~19%): should traverse BOM and propose price bump on TEST_DISH_SLUG
  const spikeRes = await evaluateWholesalePriceSpike(testItemId, 12500);
  assert.ok(spikeRes);
  assert.ok(spikeRes.spikePercent >= 15);
  assert.ok(spikeRes.affectedDishes.includes(TEST_DISH_SLUG));
  assert.equal(spikeRes.pricingSuggestionsCreated, 1);

  const suggestions = await db
    .select()
    .from(pricingSuggestionsTable)
    .where(eq(pricingSuggestionsTable.slug, TEST_DISH_SLUG));
  assert.ok(suggestions.length >= 1);
  assert.ok(suggestions[0]?.rationale.includes("spiked by"));
  assert.equal(suggestions[0]?.status, "pending");
});

test("processBiometricAnomaly alerts the RD with a PROPOSAL and never writes targets itself", async () => {
  // Normal reading (115 mg/dL): nothing happens.
  const normRes = await processBiometricAnomaly(testUserId, 115);
  assert.equal(normRes.targetAdjusted, false);
  assert.equal(normRes.restrictedIngredients.length, 0);

  // Snapshot targets BEFORE the spike — the engine must not touch them.
  const targetsBefore = await db
    .select()
    .from(dailyTargetsTable)
    .where(eq(dailyTargetsTable.userId, testUserId));

  // Hyperglycemic postprandial spike (165 mg/dL): alert + proposal, no writes.
  const spikeRes = await processBiometricAnomaly(testUserId, 165);
  assert.equal(
    spikeRes.targetAdjusted,
    false,
    "a self-reported reading must NEVER auto-modify clinical targets — the first draft did, and this pins the review that removed it",
  );
  assert.equal(spikeRes.proposedFiberTargetGrams, 36); // 28 + 8, proposed to the RD
  assert.equal(spikeRes.rdAlertGenerated, true);
  assert.ok(spikeRes.restrictedIngredients.includes("refined-sugar"));

  // daily_targets is byte-identical to before the spike.
  const targetsAfter = await db
    .select()
    .from(dailyTargetsTable)
    .where(eq(dailyTargetsTable.userId, testUserId));
  assert.deepEqual(
    targetsAfter,
    targetsBefore,
    "the engine wrote daily_targets — the autonomous clinical intervention is back",
  );

  // Advisory cautions surface for the UI…
  const lockouts = await getPatientIngredientLockouts(testUserId);
  assert.ok(lockouts.reason?.includes("advisory"));
  assert.ok(lockouts.restrictedIngredients.includes("refined-sugar"));

  // …and the RD note carries the reading, the proposal, and the disclaimer.
  const rdNotes = await db
    .select()
    .from(rdClientSummariesTable)
    .where(eq(rdClientSummariesTable.userId, testUserId));
  assert.equal(rdNotes.length, 1);
  assert.ok(rdNotes[0]?.summary.includes("165 mg/dL"));
  assert.ok(rdNotes[0]?.summary.includes("PROPOSED"));
  assert.ok(rdNotes[0]?.summary.includes("No targets have been changed automatically"));
});
