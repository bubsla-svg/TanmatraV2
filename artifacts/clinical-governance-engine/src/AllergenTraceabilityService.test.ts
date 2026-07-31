/**
 * Pins validateOrderAgainstHiddenMetadata's behavior across the Set-hoist
 * refactor (OA-QUICK-1.9, TODO_optimization-auditor.md): a hidden-carrier
 * allergen breach must still be caught, and a clean lot must still pass —
 * the lookup mechanism changed (per-pair array scan -> per-lot Set), the
 * clinical result must not.
 *
 * This package ships with no test framework (verify_suite.ts is a narrative
 * demo script with no assertions) — node:assert keeps this zero-dependency,
 * consistent with the package's own description.
 *
 * Run:
 *   npx ts-node src/AllergenTraceabilityService.test.ts
 */
import assert from 'node:assert/strict';
import {
  AllergenTraceabilityService,
  type DishProductionBatch,
  type OrderTraceabilityRecord,
  type RecallCommunicationGateway,
  type SupplierLotMetadata,
} from './AllergenTraceabilityService';

function lot(overrides: Partial<SupplierLotMetadata>): SupplierLotMetadata {
  return {
    ingredient_code: 'ING_001',
    ingredient_name: 'Test Ingredient',
    supplier_id: 'SUP_001',
    supplier_lot_number: 'LOT_TEST_001',
    coa_verified_ppm: {},
    hidden_carrier_allergens: [],
    receipt_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// A declared hidden carrier allergen (e.g. a peanut-oil carrier in a
// "peanut-free" labeled ingredient) must still be caught, case-insensitively.
{
  const result = AllergenTraceabilityService.validateOrderAgainstHiddenMetadata(
    ['peanut'],
    [lot({hidden_carrier_allergens: ['SOY', 'PEANUT']})],
  );
  assert.equal(result.isSafe, false);
  assert.equal(result.conflictingLot?.supplier_lot_number, 'LOT_TEST_001');
  assert.match(result.reason ?? '', /Hidden variant allergen breach/);
}

// A CoA-verified ppm breach (declared allergen-free, but lab-tested > 0ppm)
// must still be caught independent of the hidden-carrier check.
{
  const result = AllergenTraceabilityService.validateOrderAgainstHiddenMetadata(
    ['gluten'],
    [lot({coa_verified_ppm: {gluten_ppm: 3}})],
  );
  assert.equal(result.isSafe, false);
  assert.match(result.reason ?? '', /CoA ppm threshold breach/);
}

// A lot with no matching hidden carrier and 0ppm across the board is safe.
{
  const result = AllergenTraceabilityService.validateOrderAgainstHiddenMetadata(
    ['peanut', 'gluten'],
    [
      lot({
        hidden_carrier_allergens: ['SESAME'],
        coa_verified_ppm: {peanut_ppm: 0, gluten_ppm: 0},
      }),
    ],
  );
  assert.equal(result.isSafe, true);
  assert.equal(result.conflictingLot, undefined);
}

// Multiple lots: the breach must be found even when it is not the first lot
// scanned, and an unrelated earlier lot's allergens must not false-positive.
{
  const result = AllergenTraceabilityService.validateOrderAgainstHiddenMetadata(
    ['egg'],
    [
      lot({supplier_lot_number: 'LOT_CLEAN', hidden_carrier_allergens: ['MILK']}),
      lot({supplier_lot_number: 'LOT_DIRTY', hidden_carrier_allergens: ['EGG']}),
    ],
  );
  assert.equal(result.isSafe, false);
  assert.equal(result.conflictingLot?.supplier_lot_number, 'LOT_DIRTY');
}

// No patient allergies -> always safe, regardless of lot contents.
{
  const result = AllergenTraceabilityService.validateOrderAgainstHiddenMetadata(
    [],
    [lot({hidden_carrier_allergens: ['PEANUT'], coa_verified_ppm: {peanut_ppm: 50}})],
  );
  assert.equal(result.isSafe, true);
}

console.log('✅ AllergenTraceabilityService.validateOrderAgainstHiddenMetadata: all assertions passed');

/**
 * OA-MED-1.22/1.23 (TODO_optimization-auditor.md): executeContaminationRecallDrill
 * used to linear-scan every record ever registered, and activeRecords never
 * evicted — so a recalled order stayed in the ledger (and kept costing scan
 * time) forever. The batch index + eviction rewrite must:
 *   1. Still find every order whose dishes reference the contaminated batch,
 *      and only those orders (not orders on an unrelated batch).
 *   2. Still take the right gateway action per order status and flip it to
 *      CANCELLED_RECALLED.
 *   3. Evict a recalled order from the ledger — proven by re-running the
 *      drill against the same batch and getting zero, not the same order
 *      re-identified.
 *   4. Evict a multi-batch order from EVERY batch's index entry, not just
 *      the one that triggered the recall — proven by running the drill on
 *      the order's OTHER batch afterward and getting zero for it too.
 */

class FakeGateway implements RecallCommunicationGateway {
  cancelled: string[] = [];
  intercepted: string[] = [];
  recalled: string[] = [];
  async cancelKitchenPrepTicket(orderId: string): Promise<void> {
    this.cancelled.push(orderId);
  }
  async interceptRiderTransit(orderId: string): Promise<void> {
    this.intercepted.push(orderId);
  }
  async broadcastCustomerRecall(orderId: string): Promise<void> {
    this.recalled.push(orderId);
  }
}

function batch(id: string): DishProductionBatch {
  return {
    dish_id: `DISH_${id}`,
    dish_name: `Dish ${id}`,
    production_batch_id: id,
    prep_bay: 'BAY_1',
    ingredient_lots: [],
  };
}

function order(
  id: string,
  status: OrderTraceabilityRecord['order_status'],
  batchIds: string[],
): OrderTraceabilityRecord {
  return {
    order_id: id,
    patient_id: `PATIENT_${id}`,
    kitchen_id: 'KITCHEN_1',
    prep_bay: 'BAY_1',
    packer_id: 'PACKER_1',
    timestamp_sealed: new Date().toISOString(),
    order_status: status,
    patient_allergen_profile: [],
    kds_critical_flag: 'STANDARD PREP - NO ALLERGEN FLAGS',
    dishes: batchIds.map(batch),
    tamper_seal_barcode: `SEAL_${id}`,
  };
}

async function testRecallDrillIndexAndEviction() {
  const gateway = new FakeGateway();
  const svc = new AllergenTraceabilityService(gateway);

  svc.registerOrderTraceability(order('O1', 'IN_PREP', ['B1']));
  svc.registerOrderTraceability(order('O2', 'OUT_FOR_DELIVERY', ['B1']));
  svc.registerOrderTraceability(order('O3', 'DELIVERED', ['B1', 'B2'])); // multi-batch
  svc.registerOrderTraceability(order('O4', 'IN_PREP', ['B2']));

  // 1 + 2: drill on B1 finds exactly O1/O2/O3, takes the right action each.
  const drill1 = await svc.executeContaminationRecallDrill('B1', 'test contamination');
  assert.equal(drill1.totalOrdersIdentified, 3, 'B1 should identify O1, O2, O3 only');
  assert.equal(drill1.ordersInPrepCancelled, 1);
  assert.equal(drill1.ridersIntercepted, 1);
  assert.equal(drill1.customersRecalledWithin60Mins, 1);
  assert.deepEqual(gateway.cancelled, ['O1']);
  assert.deepEqual(gateway.intercepted, ['O2']);
  assert.deepEqual(gateway.recalled, ['O3']);

  // 3: re-running the SAME drill finds nothing — O1/O2/O3 were evicted, not
  // just marked and left in the ledger to be re-identified (and re-counted)
  // every subsequent call.
  const drill1Retry = await svc.executeContaminationRecallDrill('B1', 'retry');
  assert.equal(drill1Retry.totalOrdersIdentified, 0, 'a recalled order must not be re-identified');
  assert.equal(gateway.cancelled.length, 1, 'no duplicate kitchen-cancel action');
  assert.equal(gateway.intercepted.length, 1, 'no duplicate rider-intercept action');
  assert.equal(gateway.recalled.length, 1, 'no duplicate customer-recall action');

  // 4: O3 was multi-batch (B1 + B2). It must have been evicted from B2's
  // index too, so drilling B2 now finds only O4 — not O3 a second time.
  const drill2 = await svc.executeContaminationRecallDrill('B2', 'second contamination');
  assert.equal(drill2.totalOrdersIdentified, 1, 'B2 should identify only O4 — O3 already retired');
  assert.equal(drill2.ordersInPrepCancelled, 1);
  assert.deepEqual(gateway.cancelled, ['O1', 'O4']);
}

// No top-level await under this package's CommonJS module setting; an
// unhandled rejection crashes ts-node with a non-zero exit code on its own
// (Node 15+ default), so rethrowing in .catch() is enough to fail the run.
testRecallDrillIndexAndEviction()
  .then(() => {
    console.log(
      '✅ AllergenTraceabilityService.executeContaminationRecallDrill: batch index + eviction assertions passed',
    );
  })
  .catch((err) => {
    console.error('❌ AllergenTraceabilityService.test.ts FAILED:', err);
    throw err;
  });
