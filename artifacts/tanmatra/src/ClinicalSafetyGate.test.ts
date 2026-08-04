import test from 'node:test';
import assert from 'node:assert/strict';
import { ClinicalSafetyGate } from './ClinicalSafetyGate';
import { PatientProfile, DishSpecification } from './ContraindicationEngine';
import { SupplierLotMetadata } from './AllergenTraceabilityService';

const mockPatientSafe: PatientProfile = {
  patient_id: 'PAT_SAFE_01',
  demographics: { age: 35, weight_kg: 70, is_pregnant: false },
  biomarkers: { egfr_ml_min: 90, serum_potassium_meq_l: 4.2 },
  diagnoses: [],
  allergies: []
};

const mockDishSafe: DishSpecification = {
  dish_id: 'DISH_SAFE_01',
  dish_name: 'Steamed Rice & Dal',
  nutritional_spec: {
    macros: { protein_g: 10, net_carbs_g: 30, total_fat_g: 5, added_sugars_g: 0 },
    micros: { potassium_mg: 200, phosphorus_mg: 100, sodium_mg: 300 },
    glycemic: { glycemic_index: 50, glycemic_load: 10 }
  },
  allergens: [],
  shared_facility_allergens: [],
  ingredients: ['RICE', 'LENTILS'],
  processing: {
    is_unpasteurized_dairy: false,
    contains_raw_sprouts: false,
    is_raw_unheated_greens: false,
    elisa_zero_ppm_certified: true
  }
};

test('ClinicalSafetyGate passes safe patient and dish combination', () => {
  const decision = ClinicalSafetyGate.evaluateOrderSafety(mockPatientSafe, [mockDishSafe]);

  assert.equal(decision.status, 'PASS');
  assert.equal(decision.isCheckoutBlocked, false);
  assert.equal(decision.hardStops.length, 0);
  assert.equal(decision.conflictingSupplierLots.length, 0);
  assert.match(decision.kdsCriticalFlag, /STANDARD PREP/);
});

test('ClinicalSafetyGate blocks checkout on hidden carrier allergen in supplier lot', () => {
  const patientAllergic: PatientProfile = {
    ...mockPatientSafe,
    patient_id: 'PAT_ALLERGIC_01',
    allergies: [{ allergen: 'PEANUT', severity: 'ANAPHYLACTIC' }]
  };

  const lotWithHiddenPeanut: SupplierLotMetadata = {
    ingredient_code: 'OIL_001',
    ingredient_name: 'Sunflower Oil',
    supplier_id: 'SUPP_99',
    supplier_lot_number: 'LOT_PEANUT_HIDDEN_123',
    coa_verified_ppm: { PEANUT: 50 },
    hidden_carrier_allergens: ['PEANUT'],
    receipt_timestamp: '2026-07-29T00:00:00Z'
  };

  const decision = ClinicalSafetyGate.evaluateOrderSafety(
    patientAllergic,
    [mockDishSafe],
    [lotWithHiddenPeanut],
    'BAY_ALLERGEN_ISO'
  );

  assert.equal(decision.status, 'HARD_STOP');
  assert.equal(decision.isCheckoutBlocked, true);
  assert.equal(decision.highestEscalationTier, 'TIER_3_CMO_REVIEW');
  assert.equal(decision.conflictingSupplierLots.length, 1);
  assert.equal(decision.conflictingSupplierLots[0].supplierLotNumber, 'LOT_PEANUT_HIDDEN_123');
  assert.match(decision.kdsCriticalFlag, /SEVERE PEANUT ALLERGY/);
});
