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
