import { DISHES, type DishData } from "@workspace/menu-catalog";

function isDishAllergenSafe(dish: DishData, allergens: string[]): boolean {
  if (!allergens || allergens.length === 0) return true;
  const dishAllergens = (dish.allergens || []).map((a) => a.toLowerCase());
  return !allergens.some((alg) => dishAllergens.includes(alg.toLowerCase()));
}

export interface PrecisionPlannerInput {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "fat_loss" | "muscle_gain" | "maintenance" | "diabetic_friendly";
  dietPreference: "any" | "veg" | "vegan" | "keto";
  allergens?: string[];
}

export interface ThaliMeal {
  id: number;
  slug: string;
  name: string;
  category: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  pricePaise: number;
  image?: string;
}

export interface DailyThali {
  dayNumber: number;
  dayName: string;
  meals: ThaliMeal[];
  totals: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    pricePaise: number;
  };
}

export interface PrecisionPlanResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  dailyThalis: DailyThali[];
  totalPlanPricePaise: number;
}

const ACTIVITY_MULTIPLIERS: Record<PrecisionPlannerInput["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function calculateBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: PrecisionPlannerInput["gender"]
): number {
  if (gender === "male") {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  if (gender === "female") {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 78);
}

export function calculateTdee(bmr: number, activity: PrecisionPlannerInput["activityLevel"]): number {
  const mult = ACTIVITY_MULTIPLIERS[activity] ?? 1.2;
  return Math.round(bmr * mult);
}

export function calculateMacroTargets(
  tdee: number,
  goal: PrecisionPlannerInput["goal"],
  diet: PrecisionPlannerInput["dietPreference"]
): { targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number } {
  let targetCalories = tdee;
  if (goal === "fat_loss") {
    targetCalories = Math.round(tdee * 0.8);
  } else if (goal === "muscle_gain") {
    targetCalories = Math.round(tdee * 1.15);
  }

  let pPct = 0.25;
  let cPct = 0.45;
  let fPct = 0.30;

  if (diet === "keto") {
    pPct = 0.25;
    cPct = 0.05;
    fPct = 0.70;
  } else if (diet === "vegan") {
    pPct = 0.20;
    cPct = 0.55;
    fPct = 0.25;
  } else if (goal === "diabetic_friendly") {
    pPct = 0.25;
    cPct = 0.35;
    fPct = 0.40;
  }

  return {
    targetCalories,
    targetProteinG: Math.round((targetCalories * pPct) / 4),
    targetCarbsG: Math.round((targetCalories * cPct) / 4),
    targetFatG: Math.round((targetCalories * fPct) / 9),
  };
}

export async function generatePrecisionPlanLogic(
  input: PrecisionPlannerInput
): Promise<PrecisionPlanResult> {
  const bmr = calculateBmr(input.weightKg, input.heightCm, input.age, input.gender);
  const tdee = calculateTdee(bmr, input.activityLevel);
  const { targetCalories, targetProteinG, targetCarbsG, targetFatG } = calculateMacroTargets(
    tdee,
    input.goal,
    input.dietPreference
  );

  let dishes: DishData[] = DISHES;
  if (process.env.DATABASE_URL) {
    try {
      const { liveDishes } = await import("./mealPlanner");
      const live = await liveDishes();
      if (live && live.length > 0) dishes = live;
    } catch {
      dishes = DISHES;
    }
  }

  const allergens = input.allergens ?? [];
  const safeDishes = dishes.filter((d) => {
    if (!d.isAvailable) return false;
    if (!isDishAllergenSafe(d, allergens)) return false;
    if (input.dietPreference === "vegan" || input.dietPreference === "veg") {
      if (!d.isVeg) return false;
    }
    if (input.goal === "diabetic_friendly") {
      if (d.glycaemicIndex === "high") return false;
    }
    return true;
  });

  const availableDishes = safeDishes.length > 0 ? safeDishes : dishes;

  const breakfasts = availableDishes.filter((d) => d.category === "breakfast" || d.category === "beverages" || d.category === "snacks");
  const lunches = availableDishes.filter((d) => d.category === "bowls" || d.category === "mains" || d.category === "salads" || d.category === "pasta");
  const dinners = availableDishes.filter((d) => d.category === "mains" || d.category === "bowls" || d.category === "soups" || d.category === "wraps");

  const fallbackPool = availableDishes;

  const dailyThalis: DailyThali[] = [];
  let totalPlanPricePaise = 0;

  for (let i = 0; i < 7; i++) {
    const bf = breakfasts[i % breakfasts.length] || fallbackPool[i % fallbackPool.length]!;
    const lu = lunches[i % lunches.length] || fallbackPool[(i + 1) % fallbackPool.length]!;
    const dn = dinners[i % dinners.length] || fallbackPool[(i + 2) % fallbackPool.length]!;

    const selectedMeals: ThaliMeal[] = [
      {
        id: bf.id,
        slug: bf.slug,
        name: bf.name,
        category: bf.category,
        calories: bf.macros.calories,
        proteinGrams: bf.macros.protein,
        carbsGrams: bf.macros.carbs,
        fatGrams: bf.macros.fat,
        pricePaise: bf.price,
        image: bf.image,
      },
      {
        id: lu.id,
        slug: lu.slug,
        name: lu.name,
        category: lu.category,
        calories: lu.macros.calories,
        proteinGrams: lu.macros.protein,
        carbsGrams: lu.macros.carbs,
        fatGrams: lu.macros.fat,
        pricePaise: lu.price,
        image: lu.image,
      },
      {
        id: dn.id,
        slug: dn.slug,
        name: dn.name,
        category: dn.category,
        calories: dn.macros.calories,
        proteinGrams: dn.macros.protein,
        carbsGrams: dn.macros.carbs,
        fatGrams: dn.macros.fat,
        pricePaise: dn.price,
        image: dn.image,
      },
    ];

    const dayCalories = selectedMeals.reduce((s, m) => s + m.calories, 0);
    const dayProtein = selectedMeals.reduce((s, m) => s + m.proteinGrams, 0);
    const dayCarbs = selectedMeals.reduce((s, m) => s + m.carbsGrams, 0);
    const dayFat = selectedMeals.reduce((s, m) => s + m.fatGrams, 0);
    const dayPrice = selectedMeals.reduce((s, m) => s + m.pricePaise, 0);

    totalPlanPricePaise += dayPrice;

    dailyThalis.push({
      dayNumber: i + 1,
      dayName: DAY_NAMES[i] || `Day ${i + 1}`,
      meals: selectedMeals,
      totals: {
        calories: dayCalories,
        proteinGrams: dayProtein,
        carbsGrams: dayCarbs,
        fatGrams: dayFat,
        pricePaise: dayPrice,
      },
    });
  }

  return {
    bmr,
    tdee,
    targetCalories,
    targetProteinG,
    targetCarbsG,
    targetFatG,
    dailyThalis,
    totalPlanPricePaise,
  };
}
