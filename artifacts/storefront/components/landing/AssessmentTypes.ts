// Clinical and wellness health assessment data structures, steps, and routing logic
export interface AssessmentOption {
  id: string;
  label: string;
  description?: string;
  isClinicalFlag?: boolean;
}

export interface AssessmentStepConfig {
  id: string;
  title: string;
  subtitle: string;
  type: "single" | "multi";
  options: AssessmentOption[];
}

export interface AssessmentState {
  primaryGoal: string;
  conditions: string[];
  dietTrack: string;
  dailyActivity: string;
  timeframe: string;
}

export const INITIAL_ASSESSMENT_STATE: AssessmentState = {
  primaryGoal: "glucose_stability",
  conditions: [],
  dietTrack: "veg",
  dailyActivity: "sedentary",
  timeframe: "routine_90",
};

export const ASSESSMENT_STEPS: AssessmentStepConfig[] = [
  {
    id: "goal",
    title: "What is your primary wellness target?",
    subtitle: "We align dietary macro pools and eating cadences to your objective.",
    type: "single",
    options: [
      {
        id: "glucose_stability",
        label: "Glycemic & Glucose Stability",
        description: "Prevent spikes and moderate daily insulin response.",
      },
      {
        id: "metabolic_reset",
        label: "Metabolic Health & Weight Reset",
        description: "Sustainable metabolic improvements with nutrient density.",
      },
      {
        id: "lean_muscle",
        label: "Lean Muscle & Protein Recovery",
        description: "High-protein formulations for endurance and strength.",
      },
      {
        id: "workday_energy",
        label: "Sustained Workday Focus",
        description: "Steady energy release to avoid afternoon crash.",
      },
    ],
  },
  {
    id: "conditions",
    title: "Any clinical dietary flags or medical concerns?",
    subtitle: "Select all that apply so we can route you safely to certified Clinical Dietitians.",
    type: "multi",
    options: [
      {
        id: "t2d",
        label: "Type 2 Diabetes / Pre-Diabetes",
        description: "Requires specialized low-GI carbohydrate budgeting.",
        isClinicalFlag: true,
      },
      {
        id: "pcos",
        label: "PCOS / Insulin Resistance",
        description: "Requires hormone-friendly lipid and glycemic profiles.",
        isClinicalFlag: true,
      },
      {
        id: "ckd",
        label: "Renal / Electrolyte Restrictions (CKD)",
        description: "Requires strict protein, sodium, and potassium titration.",
        isClinicalFlag: true,
      },
      {
        id: "cardiac",
        label: "Cardiac / High Cholesterol",
        description: "Heart-healthy unsaturated fats and soluble fiber.",
        isClinicalFlag: true,
      },
      {
        id: "none",
        label: "None / General Wellness Only",
        description: "No specialized clinical contraindications.",
      },
    ],
  },
  {
    id: "diet",
    title: "What is your daily dietary track?",
    subtitle: "Every meal plan track is strictly prepared in dedicated culinary workflows.",
    type: "single",
    options: [
      {
        id: "veg",
        label: "Vegetarian",
        description: "Paneer, tofu, lentils, and diverse functional vegetables.",
      },
      {
        id: "egg",
        label: "Egg-itarian",
        description: "Includes pastured eggs alongside wholesome vegetarian foundations.",
      },
      {
        id: "nonveg",
        label: "Non-Vegetarian",
        description: "Includes lean fish, chicken, and eggs.",
      },
    ],
  },
  {
    id: "activity",
    title: "What is your daily routine activity level?",
    subtitle: "Calibrated for precise caloric baseline setting.",
    type: "single",
    options: [
      {
        id: "sedentary",
        label: "Desk Hours / Sedentary",
        description: "Mostly sitting during regular professional working hours.",
      },
      {
        id: "moderate",
        label: "Moderate Activity",
        description: "Daily walking, regular stretching, or recreational fitness.",
      },
      {
        id: "athletic",
        label: "High Performance / Athletic",
        description: "Intense daily gym training or endurance athletic running.",
      },
    ],
  },
  {
    id: "timeframe",
    title: "What is your preferred support horizon?",
    subtitle: "Commitment timelines for metabolic habit adaptation.",
    type: "single",
    options: [
      {
        id: "immediate_30",
        label: "Immediate Kickstart (30 Days)",
        description: "Rapid structure and dietary stability over one month.",
      },
      {
        id: "routine_90",
        label: "Sustained Metabolic Routine (90+ Days)",
        description: "Comprehensive cellular health transformation.",
      },
    ],
  },
];

/**
 * Resolves assessment destination based on clinical flags.
 * Profiles selecting T2D, CKD, PCOS, or cardiac flags route to free 15-min RD consult (/rd).
 * Wellness profiles route to direct checkout or plans anchor (#plans).
 */
export function resolveAssessmentOutcome(state: AssessmentState): "/rd" | "#plans" {
  const hasClinicalCondition = state.conditions.some((c) =>
    ["t2d", "pcos", "ckd", "cardiac"].includes(c),
  );
  if (hasClinicalCondition) {
    return "/rd";
  }
  return "#plans";
}
