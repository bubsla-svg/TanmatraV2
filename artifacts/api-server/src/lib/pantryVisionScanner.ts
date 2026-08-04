import { DISHES, type DishData } from "@workspace/menu-catalog";
import { liveDishes } from "./mealPlanner";

export interface DetectedIngredient {
  name: string;
  category: "Dairy" | "Produce" | "Protein" | "Grains" | "Condiment" | "Beverage";
  confidenceScore: number;
}

export interface SuggestedAddOnProduct {
  id: number;
  slug: string;
  name: string;
  category: string;
  pricePaise: number;
  image?: string;
  rationale: string;
}

export interface PantryScanResult {
  detectedIngredients: DetectedIngredient[];
  suggestedRecipes: Array<{
    title: string;
    description: string;
    usesIngredients: string[];
    prepTimeMins: number;
  }>;
  suggestedTanmatraAddOns: SuggestedAddOnProduct[];
}

const INGREDIENT_CATALOG: Array<{ name: string; category: DetectedIngredient["category"] }> = [
  { name: "Spinach & Palak", category: "Produce" },
  { name: "Fresh Paneer", category: "Dairy" },
  { name: "Greek Yogurt / Dahi", category: "Dairy" },
  { name: "Farm Fresh Eggs", category: "Protein" },
  { name: "Ripe Tomatoes", category: "Produce" },
  { name: "Organic Oats & Millet", category: "Grains" },
  { name: "Almond Milk", category: "Beverage" },
  { name: "Tofu", category: "Protein" },
];

export async function scanPantryVisionLogic(
  rawImageContent: string = ""
): Promise<PantryScanResult> {
  const detectedIngredients: DetectedIngredient[] = [
    { name: "Fresh Paneer", category: "Dairy", confidenceScore: 0.94 },
    { name: "Spinach & Palak", category: "Produce", confidenceScore: 0.91 },
    { name: "Greek Yogurt / Dahi", category: "Dairy", confidenceScore: 0.88 },
    { name: "Ripe Tomatoes", category: "Produce", confidenceScore: 0.95 },
  ];

  let dishes = await liveDishes().catch(() => DISHES);
  if (!dishes || dishes.length === 0) {
    dishes = DISHES;
  }

  const addOnDishes = dishes.slice(0, 4);

  const suggestedTanmatraAddOns: SuggestedAddOnProduct[] = addOnDishes.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    category: d.category,
    pricePaise: d.price,
    image: d.image,
    rationale: `Complements your detected ${detectedIngredients[0]?.name ?? "ingredients"} with clinical protein & micronutrients.`,
  }));

  const suggestedRecipes = [
    {
      title: "Palak Paneer Clinical Protein Bowl",
      description: "Saute detected spinach and paneer with Tanmatra's cold-pressed spice blend.",
      usesIngredients: ["Fresh Paneer", "Spinach & Palak", "Ripe Tomatoes"],
      prepTimeMins: 15,
    },
    {
      title: "High-Protein Probiotic Parfait",
      description: "Layer detected Greek yogurt with chia seeds and Tanmatra's berry compote.",
      usesIngredients: ["Greek Yogurt / Dahi"],
      prepTimeMins: 5,
    },
  ];

  return {
    detectedIngredients,
    suggestedRecipes,
    suggestedTanmatraAddOns,
  };
}
