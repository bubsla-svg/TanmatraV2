/**
 * Wearable Telemetry Payload normalized across providers (Apple, Android, Fitbit, etc.)
 */
export interface WearableTelemetryPayload {
  user_id: string;
  timestamp_window: string;
  telemetry: {
    active_calories_burned_today: number;
    resting_heart_rate: number;
    hrv_status: 'low_strain' | 'normal' | 'high_strain';
    sleep_efficiency_score: number;
    cgm_glucose_trend:
      | 'falling_rapidly'
      | 'falling'
      | 'stable'
      | 'rising'
      | 'rising_rapidly';
    current_glucose_mgdl: number;
  };
}

/**
 * Normalized Target Nutritional Vector and associated clinical weights
 */
export interface TargetNutritionalVector {
  protocol: 'Wellness' | 'Performance' | 'Clinical';
  carbs_target_g: number;
  protein_target_g: number;
  fat_target_g: number;
  weight_carbs: number;
  weight_protein: number;
  weight_fat: number;
  clinical_reasoning: string;
}

/**
 * Product Listing catalog item within the Tanmatra database
 */
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  protocol: 'Wellness' | 'Performance' | 'Clinical';
  tags: string[];
}

/**
 * Scored output schema representing exact distance fits
 */
export interface ScoringResult {
  menuItem: MenuItem;
  distance: number;
  rank: number;
  matchScore: number; // Normalized percentage match (0% - 100%)
}

export class WearableMealScoringEngine {
  // Baseline balanced per-meal targets
  private static readonly BASELINE_CARBS = 40;
  private static readonly BASELINE_PROTEIN = 30;
  private static readonly BASELINE_FAT = 12;

  /**
   * Phase 2: Translate raw real-time biometrics into clinical nutrient vectors
   */
  public static translateTelemetry(
    payload: WearableTelemetryPayload,
  ): TargetNutritionalVector {
    const {telemetry} = payload;

    // 1. Clinical Protocol: Active Hyperglycemic Spike
    if (telemetry.current_glucose_mgdl > 160) {
      return {
        protocol: 'Clinical',
        carbs_target_g: 10, // Enforce ultra-low carbohydrate threshold (<15g net carbs)
        protein_target_g: 35,
        fat_target_g: 15,
        weight_carbs: 3.0, // Aggressively penalize carbohydrates to flatten spike
        weight_protein: 1.5,
        weight_fat: 1.0,
        clinical_reasoning:
          'CGM alert: Active glycemic spike (>160 mg/dL). Activating Therapeutic Clinical Protocol to enforce immediate carbohydrate restriction (<15g net carbs).',
      };
    }

    // 2. Clinical Protocol: Active Hypoglycemic Slide
    if (
      telemetry.current_glucose_mgdl < 80 &&
      telemetry.cgm_glucose_trend === 'falling_rapidly'
    ) {
      return {
        protocol: 'Clinical',
        carbs_target_g: 35, // Low-GI, complex carbohydrates with rich fiber
        protein_target_g: 18,
        fat_target_g: 6,
        weight_carbs: 2.0, // Ensure targeted, steady complex carbohydrate delivery
        weight_protein: 1.5,
        weight_fat: 1.0,
        clinical_reasoning:
          'CGM alert: Rapid hypoglycemic trend detected (<80 mg/dL). Activating Therapeutic Clinical Protocol to prioritize low-GI complex carbohydrate replenishment.',
      };
    }

    // 3. Performance Protocol: High Calorie Active Burn
    if (telemetry.active_calories_burned_today > 600) {
      return {
        protocol: 'Performance',
        carbs_target_g: Math.round(this.BASELINE_CARBS * 1.25), // +25% carbohydrate multiplier
        protein_target_g: this.BASELINE_PROTEIN + 15, // +15g protein scale-up
        fat_target_g: this.BASELINE_FAT,
        weight_carbs: 1.5,
        weight_protein: 2.5, // Heavy prioritization on muscle protein synthesis
        weight_fat: 1.0,
        clinical_reasoning:
          'Fulfillment trigger: High active caloric burn (>600 kcal) detected. Activating Sports Performance Protocol to drive glycogen replenishment and recovery.',
      };
    }

    // 4. Wellness Protocol: Elevated Stress / Sleep Deprivation
    if (
      telemetry.sleep_efficiency_score < 0.75 ||
      telemetry.hrv_status === 'low_strain'
    ) {
      return {
        protocol: 'Wellness',
        carbs_target_g: 20, // Light, highly digestible options to reduce metabolic strain
        protein_target_g: 6,
        fat_target_g: 4,
        weight_carbs: 1.2,
        weight_protein: 1.2,
        weight_fat: 2.0, // Lipid focus to promote cellular structural recovery
        clinical_reasoning:
          'Biometric strain detected: Sleep efficiency < 75% or low HRV strain. Activating Wellness Protocol to select light, easily digestible, and anti-inflammatory meals.',
      };
    }

    // Default Baseline (Steady State Wellness Mode)
    return {
      protocol: 'Wellness',
      carbs_target_g: this.BASELINE_CARBS,
      protein_target_g: this.BASELINE_PROTEIN,
      fat_target_g: this.BASELINE_FAT,
      weight_carbs: 1.0,
      weight_protein: 1.0,
      weight_fat: 1.0,
      clinical_reasoning:
        'Steady-state biometrics detected. Displaying standard balanced macronutrient baseline.',
    };
  }

  /**
   * Phase 3: Distance calculation using Weighted Euclidean Distance Matrix
   */
  public static calculateEuclideanDistance(
    target: TargetNutritionalVector,
    item: MenuItem,
  ): number {
    const diffCarbs = item.carbs_g - target.carbs_target_g;
    const diffProtein = item.protein_g - target.protein_target_g;
    const diffFat = item.fat_g - target.fat_target_g;

    const squaredDistance =
      target.weight_carbs * Math.pow(diffCarbs, 2) +
      target.weight_protein * Math.pow(diffProtein, 2) +
      target.weight_fat * Math.pow(diffFat, 2);

    return Math.sqrt(squaredDistance);
  }

  /**
   * Phase 4: Score, sort, and rank the active menu catalog based on closest fit
   */
  public static scoreAndRankMenu(
    payload: WearableTelemetryPayload,
    menuItems: MenuItem[],
  ): ScoringResult[] {
    const targetVector = this.translateTelemetry(payload);

    const scored = menuItems.map((item) => {
      const distance = this.calculateEuclideanDistance(targetVector, item);

      // Normalize Euclidean distance into a relative, high-converting matching percentage (0% - 100%)
      const maxDistanceThreshold = 50;
      const matchScore = Math.max(
        0,
        Math.min(100, Math.round((1 - distance / maxDistanceThreshold) * 100)),
      );

      return {
        menuItem: item,
        distance,
        rank: 0,
        matchScore,
      };
    });

    // Sort ascending: closest fit (lowest distance D) receives Rank 1
    scored.sort((a, b) => a.distance - b.distance);

    return scored.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }
}
