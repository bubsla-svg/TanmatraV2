export interface PatientProfile {
  patient_id: string;
  demographics: {
    age: number;
    weight_kg: number;
    is_pregnant: boolean;
    pregnancy_trimester?: 1 | 2 | 3;
  };
  biomarkers: {
    egfr_ml_min?: number;
    serum_potassium_meq_l?: number;
    serum_phosphorus_mg_dl?: number;
    hba1c_pct?: number;
    fasting_glucose_mg_dl?: number;
    systolic_bp_mmhg?: number;
  };
  diagnoses: string[];
  allergies: Array<{
    allergen: string;
    severity: 'LOW' | 'MODERATE' | 'HIGH' | 'ANAPHYLACTIC';
  }>;
}

export interface DishSpecification {
  dish_id: string;
  dish_name: string;
  nutritional_spec: {
    macros: {
      protein_g: number;
      net_carbs_g: number;
      total_fat_g: number;
      added_sugars_g: number;
    };
    micros: {potassium_mg: number; phosphorus_mg: number; sodium_mg: number};
    glycemic: {glycemic_index: number; glycemic_load: number};
  };
  allergens: string[];
  shared_facility_allergens: string[];
  ingredients: string[];
  processing: {
    is_unpasteurized_dairy: boolean;
    contains_raw_sprouts: boolean;
    is_raw_unheated_greens: boolean;
    elisa_zero_ppm_certified: boolean;
  };
}

export interface ClinicalRuleViolation {
  rule_id: string;
  severity: 'HARD_STOP' | 'WARNING';
  escalation_tier:
    | 'TIER_1_USER_ACK'
    | 'TIER_2_RD_TELE_CONSULT'
    | 'TIER_3_CMO_REVIEW';
  description: string;
  reason: string;
}

export interface EvaluationResult {
  status: 'HARD_STOP' | 'WARNING' | 'PASS';
  is_checkout_blocked: boolean;
  requires_user_acknowledgment: boolean;
  hard_stops: ClinicalRuleViolation[];
  warnings: ClinicalRuleViolation[];
  audit_timestamp_utc: string;
  engine_version: string;
}

/**
 * Zero-dependency, high-performance deterministic JSON-Logic rule evaluator.
 * Supports standard relational and logical operators without external npm overhead.
 */
export class DeterministicJsonEvaluator {
  public static evaluate(spec: any, data: any): any {
    if (spec === null || typeof spec !== 'object') {
      return spec;
    }

    if (Array.isArray(spec)) {
      return spec.map((item) => this.evaluate(item, data));
    }

    const keys = Object.keys(spec);
    if (keys.length === 0) return spec;
    const op = keys[0];
    const args = spec[op];

    switch (op) {
      case 'var': {
        const path = Array.isArray(args) ? args[0] : args;
        if (!path || path === '') return data;
        return path
          .split('.')
          .reduce(
            (acc: any, part: string) =>
              acc !== null && acc !== undefined ? acc[part] : undefined,
            data,
          );
      }
      case 'if': {
        const evaluatedCondition = this.evaluate(args[0], data);
        if (evaluatedCondition) {
          return this.evaluate(args[1], data);
        } else {
          return args.length > 2 ? this.evaluate(args[2], data) : null;
        }
      }
      case 'or': {
        const arr = Array.isArray(args) ? args : [args];
        for (const item of arr) {
          const res = this.evaluate(item, data);
          if (res) return res;
        }
        return false;
      }
      case 'and': {
        const arr = Array.isArray(args) ? args : [args];
        let lastRes = true;
        for (const item of arr) {
          lastRes = this.evaluate(item, data);
          if (!lastRes) return false;
        }
        return lastRes;
      }
      case '<': {
        const [a, b] = this.evaluate(args, data);
        return a !== undefined && a !== null && a < b;
      }
      case '<=': {
        const [a, b] = this.evaluate(args, data);
        return a !== undefined && a !== null && a <= b;
      }
      case '>': {
        const [a, b] = this.evaluate(args, data);
        return a !== undefined && a !== null && a > b;
      }
      case '>=': {
        const [a, b] = this.evaluate(args, data);
        return a !== undefined && a !== null && a >= b;
      }
      case '==': {
        const [a, b] = this.evaluate(args, data);
        return a === b;
      }
      case '!': {
        const val = Array.isArray(args)
          ? this.evaluate(args[0], data)
          : this.evaluate(args, data);
        return !val;
      }
      case 'in': {
        const [needle, haystack] = this.evaluate(args, data);
        if (Array.isArray(haystack)) {
          return haystack.includes(needle);
        }
        if (typeof haystack === 'string' && typeof needle === 'string') {
          return haystack.includes(needle);
        }
        return false;
      }
      case 'some': {
        const targetArr = this.evaluate(args[0], data);
        const predicate = args[1];
        if (!Array.isArray(targetArr)) return false;
        return targetArr.some((item) => this.evaluate(predicate, item));
      }
      default:
        return spec;
    }
  }
}

export class ClinicalContraindicationEngine {
  private readonly engineVersion = '1.0.0-PROD';
  private readonly jsonRules: Array<{
    rule_spec: any;
    meta: Omit<ClinicalRuleViolation, 'reason'>;
  }> = [];

  constructor() {
    this.registerBuiltInRules();
  }

  private registerBuiltInRules(): void {
    // Rule 1: CKD Stage 3b+ Hard Stop
    this.jsonRules.push({
      meta: {
        rule_id: 'RULE_CKD_HARD_STOP_V1',
        severity: 'HARD_STOP',
        escalation_tier: 'TIER_2_RD_TELE_CONSULT',
        description: 'Renal electrolyte and protein threshold breach.',
      },
      rule_spec: {
        if: [
          {
            or: [
              {'<': [{var: 'patient.biomarkers.egfr_ml_min'}, 45]},
              {'>': [{var: 'patient.biomarkers.serum_potassium_meq_l'}, 5.0]},
              {'>': [{var: 'patient.biomarkers.serum_phosphorus_mg_dl'}, 4.6]},
              {in: ['CKD_STAGE_3B', {var: 'patient.diagnoses'}]},
              {in: ['CKD_STAGE_4', {var: 'patient.diagnoses'}]},
              {in: ['CKD_STAGE_5', {var: 'patient.diagnoses'}]},
              {in: ['END_STAGE_RENAL_DISEASE', {var: 'patient.diagnoses'}]},
            ],
          },
          {
            or: [
              {'>': [{var: 'dish.nutritional_spec.micros.potassium_mg'}, 600]},
              {'>': [{var: 'dish.nutritional_spec.micros.phosphorus_mg'}, 230]},
              {'>': [{var: 'dish.nutritional_spec.macros.protein_g'}, 25]},
              {
                some: [
                  {var: 'dish.ingredients'},
                  {
                    in: [
                      {var: ''},
                      [
                        'SPINACH',
                        'AVOCADO',
                        'POTATO',
                        'BEETROOT',
                        'BANANA',
                        'COCONUT_WATER',
                        'TOMATO_PASTE',
                      ],
                    ],
                  },
                ],
              },
            ],
          },
          false,
        ],
      },
    });

    // Rule 2: IgE Allergen Anaphylaxis Hard Stop
    this.jsonRules.push({
      meta: {
        rule_id: 'RULE_ALLERGEN_HARD_STOP_V1',
        severity: 'HARD_STOP',
        escalation_tier: 'TIER_2_RD_TELE_CONSULT',
        description: 'Anaphylactic IgE allergen cross-contact breach.',
      },
      rule_spec: {
        some: [
          {var: 'patient.allergies'},
          {
            and: [
              {in: [{var: 'severity'}, ['HIGH', 'ANAPHYLACTIC']]},
              {
                or: [
                  {in: [{var: 'allergen'}, {var: 'dish.allergens'}]},
                  {
                    and: [
                      {
                        in: [
                          {var: 'allergen'},
                          {var: 'dish.shared_facility_allergens'},
                        ],
                      },
                      {
                        '!': [
                          {var: 'dish.processing.elisa_zero_ppm_certified'},
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    // Rule 3: Uncontrolled T2D Hard Stop
    this.jsonRules.push({
      meta: {
        rule_id: 'RULE_T2D_UNCONTROLLED_HARD_STOP_V1',
        severity: 'HARD_STOP',
        escalation_tier: 'TIER_2_RD_TELE_CONSULT',
        description: 'High glycemic load breach in uncontrolled T2D.',
      },
      rule_spec: {
        if: [
          {
            or: [
              {'>': [{var: 'patient.biomarkers.hba1c_pct'}, 9.0]},
              {'>': [{var: 'patient.biomarkers.fasting_glucose_mg_dl'}, 250]},
              {in: ['T2D_UNCONTROLLED', {var: 'patient.diagnoses'}]},
            ],
          },
          {
            or: [
              {
                '>': [
                  {var: 'dish.nutritional_spec.glycemic.glycemic_load'},
                  15,
                ],
              },
              {'>': [{var: 'dish.nutritional_spec.macros.net_carbs_g'}, 45]},
              {
                '>': [
                  {var: 'dish.nutritional_spec.glycemic.glycemic_index'},
                  70,
                ],
              },
            ],
          },
          false,
        ],
      },
    });

    // Rule 4: Gestational Listeria/Sprouts Hard Stop
    this.jsonRules.push({
      meta: {
        rule_id: 'RULE_GESTATIONAL_SAFETY_HARD_STOP_V1',
        severity: 'HARD_STOP',
        escalation_tier: 'TIER_2_RD_TELE_CONSULT',
        description: 'Teratogenic or Listeria pathogen risk during pregnancy.',
      },
      rule_spec: {
        if: [
          {
            or: [
              {'==': [{var: 'patient.demographics.is_pregnant'}, true]},
              {
                in: [
                  {var: 'patient.demographics.pregnancy_trimester'},
                  [1, 2, 3],
                ],
              },
              {in: ['PREGNANCY', {var: 'patient.diagnoses'}]},
              {in: ['GESTATIONAL_DIABETES', {var: 'patient.diagnoses'}]},
            ],
          },
          {
            or: [
              {'==': [{var: 'dish.processing.is_unpasteurized_dairy'}, true]},
              {'==': [{var: 'dish.processing.contains_raw_sprouts'}, true]},
              {'==': [{var: 'dish.processing.is_raw_unheated_greens'}, true]},
              {
                some: [
                  {var: 'dish.ingredients'},
                  {
                    in: [
                      {var: ''},
                      [
                        'UNPASTEURIZED_CURD',
                        'RAW_MILK',
                        'MUNG_SPROUTS',
                        'ALFALFA_SPROUTS',
                        'SWORDFISH',
                        'KING_MACKEREL',
                      ],
                    ],
                  },
                ],
              },
            ],
          },
          false,
        ],
      },
    });

    // Rule 5: Controlled T2D Warning
    this.jsonRules.push({
      meta: {
        rule_id: 'RULE_T2D_CONTROLLED_WARNING_V1',
        severity: 'WARNING',
        escalation_tier: 'TIER_1_USER_ACK',
        description: 'Moderate glycemic load requiring user acknowledgment.',
      },
      rule_spec: {
        if: [
          {
            and: [
              {'<=': [{var: 'patient.biomarkers.hba1c_pct'}, 9.0]},
              {'>=': [{var: 'patient.biomarkers.hba1c_pct'}, 6.5]},
              {in: ['TYPE_2_DIABETES', {var: 'patient.diagnoses'}]},
            ],
          },
          {
            or: [
              {
                '>': [
                  {var: 'dish.nutritional_spec.glycemic.glycemic_index'},
                  55,
                ],
              },
              {'>': [{var: 'dish.nutritional_spec.macros.net_carbs_g'}, 35]},
            ],
          },
          false,
        ],
      },
    });

    // Rule 6: Mild Hypertension Sodium Warning
    this.jsonRules.push({
      meta: {
        rule_id: 'RULE_HTN_SODIUM_WARNING_V1',
        severity: 'WARNING',
        escalation_tier: 'TIER_1_USER_ACK',
        description: 'Sodium exceeds 600mg per-meal DASH threshold.',
      },
      rule_spec: {
        if: [
          {
            or: [
              {'>=': [{var: 'patient.biomarkers.systolic_bp_mmhg'}, 130]},
              {in: ['HYPERTENSION', {var: 'patient.diagnoses'}]},
            ],
          },
          {'>': [{var: 'dish.nutritional_spec.micros.sodium_mg'}, 600]},
          false,
        ],
      },
    });
  }

  public evaluateDish(
    patient: PatientProfile,
    dish: DishSpecification,
  ): EvaluationResult {
    const payload = {patient, dish};
    const hardStops: ClinicalRuleViolation[] = [];
    const warnings: ClinicalRuleViolation[] = [];

    for (const rule of this.jsonRules) {
      const isViolated = DeterministicJsonEvaluator.evaluate(
        rule.rule_spec,
        payload,
      );
      if (isViolated === true) {
        const violation: ClinicalRuleViolation = {
          ...rule.meta,
          reason: `Patient ${patient.patient_id} triggered ${rule.meta.rule_id} against dish '${dish.dish_name}' (${dish.dish_id}).`,
        };

        if (rule.meta.severity === 'HARD_STOP') {
          hardStops.push(violation);
        } else {
          warnings.push(violation);
        }
      }
    }

    let status: 'HARD_STOP' | 'WARNING' | 'PASS' = 'PASS';
    if (hardStops.length > 0) {
      status = 'HARD_STOP';
    } else if (warnings.length > 0) {
      status = 'WARNING';
    }

    return {
      status,
      is_checkout_blocked: hardStops.length > 0,
      requires_user_acknowledgment:
        warnings.length > 0 && hardStops.length === 0,
      hard_stops: hardStops,
      warnings,
      audit_timestamp_utc: new Date().toISOString(),
      engine_version: this.engineVersion,
    };
  }
}
