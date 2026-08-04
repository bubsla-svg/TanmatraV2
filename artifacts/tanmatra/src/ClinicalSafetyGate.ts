import {
  PatientProfile,
  DishSpecification,
  ClinicalContraindicationEngine,
  ClinicalRuleViolation,
  EvaluationResult
} from './ContraindicationEngine';
import {
  SupplierLotMetadata,
  AllergenTraceabilityService
} from './AllergenTraceabilityService';

export interface ConflictingSupplierLot {
  ingredientCode: string;
  ingredientName: string;
  supplierLotNumber: string;
  conflictingAllergen: string;
  reason: string;
}

export interface SafetyGateDecision {
  status: 'PASS' | 'WARNING' | 'HARD_STOP';
  isCheckoutBlocked: boolean;
  requiresUserAcknowledgment: boolean;
  highestEscalationTier?: 'TIER_1_USER_ACK' | 'TIER_2_RD_TELE_CONSULT' | 'TIER_3_CMO_REVIEW';
  kdsCriticalFlag: string;
  hardStops: ClinicalRuleViolation[];
  warnings: ClinicalRuleViolation[];
  conflictingSupplierLots: ConflictingSupplierLot[];
  auditTimestampUtc: string;
  engineVersion: string;
}

/**
 * Deep, unified clinical governance and allergen safety decision gate.
 * Single atomic entrypoint for evaluating patient orders against medical contraindications,
 * IgE anaphylaxis rules, and supplier lot hidden carrier allergens.
 */
export class ClinicalSafetyGate {
  private static readonly contraindicationEngine = new ClinicalContraindicationEngine();

  /**
   * Atomically evaluates an order for clinical contraindications and hidden supplier lot allergens.
   */
  public static evaluateOrderSafety(
    patient: PatientProfile,
    dishes: DishSpecification[],
    ingredientLots: SupplierLotMetadata[] = [],
    designatedBay: string = 'BAY_1_ALLERGEN_SAFE'
  ): SafetyGateDecision {
    const patientAllergies = patient.allergies.map(a => a.allergen);

    // 1. Evaluate medical contraindications and IgE rules via ClinicalContraindicationEngine
    const clinicalHardStops: ClinicalRuleViolation[] = [];
    const clinicalWarnings: ClinicalRuleViolation[] = [];

    for (const dish of dishes) {
      const evalRes: EvaluationResult = this.contraindicationEngine.evaluateDish(patient, dish);
      if (evalRes.hard_stops && evalRes.hard_stops.length > 0) {
        clinicalHardStops.push(...evalRes.hard_stops);
      }
      if (evalRes.warnings && evalRes.warnings.length > 0) {
        clinicalWarnings.push(...evalRes.warnings);
      }
    }

    // 2. Scan supplier lots for hidden carrier allergens
    const conflictingSupplierLots: ConflictingSupplierLot[] = [];
    if (ingredientLots.length > 0) {
      for (const lot of ingredientLots) {
        const lotCheck = AllergenTraceabilityService.validateOrderAgainstHiddenMetadata(
          patientAllergies,
          [lot]
        );
        if (!lotCheck.isSafe && lotCheck.conflictingLot) {
          conflictingSupplierLots.push({
            ingredientCode: lotCheck.conflictingLot.ingredient_code,
            ingredientName: lotCheck.conflictingLot.ingredient_name,
            supplierLotNumber: lotCheck.conflictingLot.supplier_lot_number,
            conflictingAllergen: patientAllergies.find(a =>
              lotCheck.conflictingLot?.hidden_carrier_allergens.map(h => h.toUpperCase()).includes(a.toUpperCase())
            ) || 'UNKNOWN_ALLERGEN',
            reason: lotCheck.reason || 'Hidden carrier allergen detected in supplier lot'
          });
        }
      }
    }

    // 3. Format non-truncated KDS isolation banner
    const kdsCriticalFlag = AllergenTraceabilityService.formatKdsCriticalFlag(
      patientAllergies,
      designatedBay
    );

    // 4. Determine overall safety status and escalation tier
    const hasHardStops = clinicalHardStops.length > 0 || conflictingSupplierLots.length > 0;
    const hasWarnings = clinicalWarnings.length > 0;

    let status: 'PASS' | 'WARNING' | 'HARD_STOP' = 'PASS';
    let isCheckoutBlocked = false;
    let requiresUserAcknowledgment = false;
    let highestEscalationTier: 'TIER_1_USER_ACK' | 'TIER_2_RD_TELE_CONSULT' | 'TIER_3_CMO_REVIEW' | undefined = undefined;

    if (hasHardStops) {
      status = 'HARD_STOP';
      isCheckoutBlocked = true;
      highestEscalationTier = 'TIER_2_RD_TELE_CONSULT';

      // Anaphylaxis or hidden lot breaches escalate to CMO review
      const hasAnaphylaxis = patient.allergies.some(a => a.severity === 'ANAPHYLACTIC');
      if (hasAnaphylaxis || conflictingSupplierLots.length > 0) {
        highestEscalationTier = 'TIER_3_CMO_REVIEW';
      }
    } else if (hasWarnings) {
      status = 'WARNING';
      requiresUserAcknowledgment = true;
      highestEscalationTier = 'TIER_1_USER_ACK';
    }

    return {
      status,
      isCheckoutBlocked,
      requiresUserAcknowledgment,
      highestEscalationTier,
      kdsCriticalFlag,
      hardStops: clinicalHardStops,
      warnings: clinicalWarnings,
      conflictingSupplierLots,
      auditTimestampUtc: new Date().toISOString(),
      engineVersion: '2.0.0-UNIFIED-GATE'
    };
  }
}
