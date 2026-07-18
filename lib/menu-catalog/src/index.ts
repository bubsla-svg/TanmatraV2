export interface DishCustomOption {
    name: string;
    priceModifier: number;
    default?: boolean;
  }

  export interface DishCustomGroup {
    groupName: string;
    type: "single" | "multiple";
    options: DishCustomOption[];
  }

  export interface DishMacros {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    calories: number;
  }

  export type DishCategory =
    | "beverages"
    | "breakfast"
    | "salads"
    | "soups"
    | "pasta"
    | "wraps"
    | "bowls"
    | "snacks"
    | "mains";
  export type DishKitchen = "continental" | "indian" | "asian" | "mediterranean";

  /**
   * How a dish is meant to be served on arrival — drives the packaging/prep
   * copy on the PDP. A single universal "reheat" template previously shipped on
   * every dish, telling customers to heat cold-pressed smoothies (with ice) and
   * raw salads. Serving copy is now derived from this enum so cold/raw items can
   * never carry heating instructions.
   *
   * - `serve_chilled` — eat straight from the fridge, never heat (smoothies,
   *   raw salads, curd bowls).
   * - `reheat` — warm through before eating (hot mains, soups, pasta, rice bowls).
   * - `ready_ambient` — ready to eat as delivered; no heating required (bakes,
   *   sandwiches, wraps).
   */
  export type DishServeMode = "serve_chilled" | "reheat" | "ready_ambient";

  export interface DishData {
    id: number;
    slug: string;
    name: string;
    description: string;
    longDescription: string;
    image: string;
    price: number;
    kitchen: DishKitchen;
    category: DishCategory;
    isVeg: boolean;
    rdVerified: boolean;
    rdNote?: string;
    prepTime: string;
    /**
     * How the dish is served on arrival. Optional: when absent it is derived
     * from `category` via `defaultServeModeForCategory` (cold categories never
     * get heating copy). Set explicitly only to override the category default
     * (e.g. a hot bake that lives in the `snacks` category → `"reheat"`).
     */
    serveMode?: DishServeMode;
    /**
     * Per-dish tasting note. When absent the UI falls back to a category-level
     * default. Set this on any dish whose category default would misdescribe it
     * (e.g. a sweet bake in the savoury `snacks` category).
     */
    tasteDescription?: string;
    macros: DishMacros;
    /**
     * Macros are ingredient-derived ESTIMATES (calculator, IFCT/USDA), not
     * RD-verified lab values. The UI labels them "estimated from ingredients".
     */
    macrosEstimated?: boolean;
    /**
     * Macros are an unresolved placeholder (duplicated seed bucket with no
     * reliable estimate). The UI gates them behind a "being verified" state.
     */
    macrosProvisional?: boolean;
    ingredients: string[];
    allergens: string[];
    /**
     * Whether the `allergens` list is a REVIEWED disclosure or unverified.
     *
     * Absent or `true` → the list is trustworthy; an empty array is an
     * affirmative "RD-reviewed, no declared allergens" statement (the legacy
     * curated catalog is all reviewed, so absence defaults to reviewed).
     *
     * `false` → allergen data is UNCHECKED ("None listed in system"): the
     * source has no reviewed disclosure. An empty `allergens` here means
     * "unknown", NOT "none" — it must never be surfaced as "no allergens",
     * and the strict checkout gate refuses the dish (`unchecked_allergens`).
     * This is the distinction between "reviewed → []" and "unknown → null".
     */
    allergensReviewed?: boolean;
    /**
     * The `allergens` list was AUTO-DERIVED from `ingredients` (see
     * `allergenDerive.ts`), not hand-reviewed by an RD. Derivation reliably
     * detects allergens that are PRESENT (only ever adds warnings) but cannot
     * certify absence, so the UI labels these "auto-detected from ingredients".
     * Set by the `DISHES` overlay; mutually meaningful with `allergensReviewed`
     * (a derived list is still refused when `allergensReviewed === false`).
     */
    allergensDerived?: boolean;
    glycaemicIndex: "low" | "medium" | "high";
    sugarPerServing: string;
    customizations: DishCustomGroup[];
    pairingSlug?: string;
    isAvailable: boolean;
    averageRating?: number | null;
    reviewCount?: number;
    contraindications?: string[];
    /**
     * RD (registered dietitian) safety review gate. Absent on legacy
     * curated entries (treated as "reviewed" by the safety evaluator).
     * CMS-managed dishes default to "pending_review" until an RD signs
     * off — the server-side checkout gate refuses any state other than
     * "reviewed", and the public menu route filters out non-reviewed
     * dishes unless the caller is a staff/RD context.
     */
    rdReviewState?: "pending_review" | "reviewed" | "blocked";
  }

  export const CATEGORY_LABELS: Record<DishCategory, string> = {
    beverages: "Beverages",
    breakfast: "Breakfast",
    salads: "Salads",
    soups: "Soups",
    pasta: "Pasta",
    wraps: "Wraps & Sandwiches",
    bowls: "Rice Bowls",
    snacks: "Snacks & Bakes",
    mains: "Mains",
  };

  export const KITCHEN_LABELS: Record<DishKitchen, string> = {
    continental: "Continental",
    indian: "Indian",
    asian: "Asian",
    mediterranean: "Mediterranean",
  };

  /**
   * Category → default serving mode, used when a dish does not set `serveMode`
   * explicitly. Cold categories (beverages, salads) resolve to `serve_chilled`
   * so a smoothie or raw salad can NEVER inherit heating copy. Hot categories
   * (soups, pasta, bowls, mains) resolve to `reheat`. The remainder default to
   * `ready_ambient` (eat as delivered) — the safe choice, since the worst case
   * is a hot bake told "no heating required" rather than a cold drink told to
   * "heat for 2 minutes". Override per-dish via `DishData.serveMode`.
   */
  const SERVE_MODE_BY_CATEGORY: Record<DishCategory, DishServeMode> = {
    beverages: "serve_chilled",
    salads: "serve_chilled",
    soups: "reheat",
    pasta: "reheat",
    bowls: "reheat",
    mains: "reheat",
    breakfast: "ready_ambient",
    wraps: "ready_ambient",
    snacks: "ready_ambient",
  };

  export function defaultServeModeForCategory(category: DishCategory): DishServeMode {
    return SERVE_MODE_BY_CATEGORY[category];
  }

  /** Resolve a dish's serving mode: explicit `serveMode` if set, else the
   * category default. Safe to call on partial DB rows that omit `serveMode`. */
  export function getServeMode(dish: Pick<DishData, "serveMode" | "category">): DishServeMode {
    return dish.serveMode ?? defaultServeModeForCategory(dish.category);
  }

  const RAW_DISHES: DishData[] = [
  {
    "id": 1,
    "slug": "activated-charcoal-smoothie",
    "imageIngredient": "/images/dishes/activated-charcoal-smoothie-ingredient.jpg",
    "imageDelivered": "/images/dishes/activated-charcoal-smoothie-delivered.jpg",
    "imagePackaging": "/images/dishes/activated-charcoal-smoothie-packaging.jpg",
    "imageLifestyle": "/images/dishes/activated-charcoal-smoothie-lifestyle.jpg",
    "name": "Activated Charcoal Smoothie",
    "description": "Activated charcoal powder, Banana, Almond milk / low, and more.",
    "longDescription": "Activated charcoal powder – ½ tsp · Banana – 1 medium (ripe) · Almond milk / low-fat milk – 200 ml · Honey – 1 tsp (optional) · Chia seeds – 1 tsp · Ice cubes – 4–5",
    "image": "/images/dishes/charcoal-smoothie.jpg",
    "price": 5000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Activated charcoal powder – ½ tsp",
      "Banana – 1 medium (ripe)",
      "Almond milk / low-fat milk – 200 ml",
      "Honey – 1 tsp (optional)",
      "Chia seeds – 1 tsp",
      "Ice cubes – 4–5"
    ],
    "allergens": [
      "Dairy",
      "Tree Nuts"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 2,
    "slug": "aglio-olio-veg",
    "imageIngredient": "/images/dishes/aglio-olio-veg-ingredient.jpg",
    "imageDelivered": "/images/dishes/aglio-olio-veg-delivered.jpg",
    "imagePackaging": "/images/dishes/aglio-olio-veg-packaging.jpg",
    "imageLifestyle": "/images/dishes/aglio-olio-veg-lifestyle.jpg",
    "name": "Aglio Olio - Veg",
    "description": "Spaghetti pasta, Olive oil, Garlic, and more.",
    "longDescription": "Spaghetti pasta – 120 g (boiled al dente) · Olive oil – 2 tbsp · Garlic – 6–8 cloves (sliced) · Dry red chili flakes – ½ tsp · Zucchini, bell peppers, broccoli – ½ cup (mixed, cut into strips) · Parsley – 1 tbsp (chopped)",
    "image": "/images/dishes/aglio-olio-veg.jpg",
    "price": 13000,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 14,
      "carbs": 65,
      "fat": 22,
      "fiber": 5,
      "calories": 480
    },
    "ingredients": [
      "Spaghetti pasta – 120 g (boiled al dente)",
      "Olive oil – 2 tbsp",
      "Garlic – 6–8 cloves (sliced)",
      "Dry red chili flakes – ½ tsp",
      "Zucchini, bell peppers, broccoli – ½ cup (mixed, cut into strips)",
      "Parsley – 1 tbsp (chopped)",
      "Salt – to taste",
      "Black pepper – ¼ tsp",
      "Parmesan cheese (optional) – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 3,
    "slug": "aglio-olio-chicken",
    "imageIngredient": "/images/dishes/aglio-olio-chicken-ingredient.jpg",
    "imageDelivered": "/images/dishes/aglio-olio-chicken-delivered.jpg",
    "imagePackaging": "/images/dishes/aglio-olio-chicken-packaging.jpg",
    "imageLifestyle": "/images/dishes/aglio-olio-chicken-lifestyle.jpg",
    "name": "Aglio Olio - Chicken",
    "description": "Spaghetti pasta, Olive oil, Garlic, and more.",
    "longDescription": "Spaghetti pasta – 120 g (boiled al dente) · Olive oil – 2 tbsp · Garlic – 6–8 cloves (sliced) · Chili flakes – ½ tsp · Grilled chicken breast – 100 g (sliced strips) · Parsley – 1 tbsp (chopped)",
    "image": "/images/dishes/aglio-olio-chicken.jpg",
    "price": 18000,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 22,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Spaghetti pasta – 120 g (boiled al dente)",
      "Olive oil – 2 tbsp",
      "Garlic – 6–8 cloves (sliced)",
      "Chili flakes – ½ tsp",
      "Grilled chicken breast – 100 g (sliced strips)",
      "Parsley – 1 tbsp (chopped)",
      "Salt – to taste",
      "Black pepper – ¼ tsp",
      "Parmesan cheese (optional) – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 4,
    "slug": "aglio-olio-prawns",
    "imageIngredient": "/images/dishes/aglio-olio-prawns-ingredient.jpg",
    "imageDelivered": "/images/dishes/aglio-olio-prawns-delivered.jpg",
    "imagePackaging": "/images/dishes/aglio-olio-prawns-packaging.jpg",
    "imageLifestyle": "/images/dishes/aglio-olio-prawns-lifestyle.jpg",
    "name": "Aglio Olio - Prawns",
    "description": "Spaghetti pasta, Olive oil, Garlic, and more.",
    "longDescription": "Spaghetti pasta – 120 g (boiled al dente) · Olive oil – 2 tbsp · Garlic – 6–8 cloves (sliced) · Chili flakes – ½ tsp · Prawns – 6–8 medium (cleaned & deveined) · Parsley – 1 tbsp (chopped)",
    "image": "/images/dishes/aglio-olio-prawns.jpg",
    "price": 20000,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 22,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Spaghetti pasta – 120 g (boiled al dente)",
      "Olive oil – 2 tbsp",
      "Garlic – 6–8 cloves (sliced)",
      "Chili flakes – ½ tsp",
      "Prawns – 6–8 medium (cleaned & deveined)",
      "Parsley – 1 tbsp (chopped)",
      "Salt – to taste",
      "Black pepper – ¼ tsp",
      "Parmesan cheese (optional) – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten",
      "Shellfish"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 5,
    "slug": "alfredo-pasta-veg",
    "imageIngredient": "/images/dishes/alfredo-pasta-veg-ingredient.jpg",
    "imageDelivered": "/images/dishes/alfredo-pasta-veg-delivered.jpg",
    "imagePackaging": "/images/dishes/alfredo-pasta-veg-packaging.jpg",
    "imageLifestyle": "/images/dishes/alfredo-pasta-veg-lifestyle.jpg",
    "name": "Alfredo Pasta - Veg",
    "description": "Spaghetti/Fettuccine pasta, Olive oil, Garlic, and more.",
    "longDescription": "Spaghetti/Fettuccine pasta – 120 g (boiled al dente) · Olive oil – 1 tbsp · Garlic – 5 g (minced) · Butter – 10 g · Fresh cream – 100 ml · Parmesan cheese – 20 g",
    "image": "/images/dishes/alfredo-pasta-veg.jpg",
    "price": 17500,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 14,
      "carbs": 65,
      "fat": 22,
      "fiber": 5,
      "calories": 480
    },
    "ingredients": [
      "Spaghetti/Fettuccine pasta – 120 g (boiled al dente)",
      "Olive oil – 1 tbsp",
      "Garlic – 5 g (minced)",
      "Butter – 10 g",
      "Fresh cream – 100 ml",
      "Parmesan cheese – 20 g",
      "Mixed vegetables (broccoli, zucchini, bell peppers) – 70 g",
      "Salt – to taste",
      "Black pepper – ¼ tsp",
      "Parsley – 1 tbsp (chopped)"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 6,
    "slug": "alfredo-pasta-chicken",
    "imageIngredient": "/images/dishes/alfredo-pasta-chicken-ingredient.jpg",
    "imageDelivered": "/images/dishes/alfredo-pasta-chicken-delivered.jpg",
    "imagePackaging": "/images/dishes/alfredo-pasta-chicken-packaging.jpg",
    "imageLifestyle": "/images/dishes/alfredo-pasta-chicken-lifestyle.jpg",
    "name": "Alfredo Pasta - Chicken",
    "description": "Pasta, Olive oil, Garlic, and more.",
    "longDescription": "Pasta – 120 g (boiled) · Olive oil – 1 tbsp · Garlic – 5 g (minced) · Butter – 10 g · Fresh cream – 100 ml · Parmesan cheese – 20 g",
    "image": "/images/dishes/alfredo-pasta-chicken.jpg",
    "price": 22500,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 22,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Pasta – 120 g (boiled)",
      "Olive oil – 1 tbsp",
      "Garlic – 5 g (minced)",
      "Butter – 10 g",
      "Fresh cream – 100 ml",
      "Parmesan cheese – 20 g",
      "Grilled chicken breast – 100 g (sliced strips)",
      "Salt & pepper – to taste",
      "Parsley – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 7,
    "slug": "alfredo-pasta-prawns",
    "imageIngredient": "/images/dishes/alfredo-pasta-prawns-ingredient.jpg",
    "imageDelivered": "/images/dishes/alfredo-pasta-prawns-delivered.jpg",
    "imagePackaging": "/images/dishes/alfredo-pasta-prawns-packaging.jpg",
    "imageLifestyle": "/images/dishes/alfredo-pasta-prawns-lifestyle.jpg",
    "name": "Alfredo Pasta - Prawns",
    "description": "Pasta, Olive oil, Garlic, and more.",
    "longDescription": "Pasta – 120 g (boiled) · Olive oil – 1 tbsp · Garlic – 5 g (minced) · Butter – 10 g · Fresh cream – 100 ml · Parmesan cheese – 20 g",
    "image": "/images/dishes/alfredo-pasta-prawns.jpg",
    "price": 24500,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 22,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Pasta – 120 g (boiled)",
      "Olive oil – 1 tbsp",
      "Garlic – 5 g (minced)",
      "Butter – 10 g",
      "Fresh cream – 100 ml",
      "Parmesan cheese – 20 g",
      "Prawns – 6–8 medium (cleaned & deveined)",
      "Salt & pepper – to taste",
      "Parsley – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten",
      "Shellfish"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 8,
    "slug": "aliya-viral-beetroot-curd",
    "imageIngredient": "/images/dishes/aliya-viral-beetroot-curd-ingredient.jpg",
    "imageDelivered": "/images/dishes/aliya-viral-beetroot-curd-delivered.jpg",
    "imagePackaging": "/images/dishes/aliya-viral-beetroot-curd-packaging.jpg",
    "imageLifestyle": "/images/dishes/aliya-viral-beetroot-curd-lifestyle.jpg",
    "name": "Aliya Viral Beetroot Curd",
    "description": "Beetroot, Hung curd, Garlic, and more.",
    "longDescription": "Beetroot – 80 g (boiled & grated) · Hung curd – 150 g · Garlic – 1 clove (crushed) · Olive oil – 1 tsp · Green chili – 1 (chopped) · Salt – to taste",
    "image": "/images/dishes/beetroot-curd.jpg",
    "price": 14500,
    "kitchen": "indian",
    "category": "mains",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 30,
      "fat": 14,
      "fiber": 5,
      "calories": 360
    },
    "ingredients": [
      "Beetroot – 80 g (boiled & grated)",
      "Hung curd – 150 g",
      "Garlic – 1 clove (crushed)",
      "Olive oil – 1 tsp",
      "Green chili – 1 (chopped)",
      "Salt – to taste",
      "Coriander leaves – 1 tbsp (chopped)"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 9,
    "slug": "almond-chicken-salad",
    "imageIngredient": "/images/dishes/almond-chicken-salad-ingredient.jpg",
    "imageDelivered": "/images/dishes/almond-chicken-salad-delivered.jpg",
    "imagePackaging": "/images/dishes/almond-chicken-salad-packaging.jpg",
    "imageLifestyle": "/images/dishes/almond-chicken-salad-lifestyle.jpg",
    "name": "Almond Chicken Salad",
    "description": "Grilled chicken breast, Lettuce, Cucumber, and more.",
    "longDescription": "Grilled chicken breast – 120 g (cubed) · Lettuce – 50 g · Cucumber – 40 g (sliced) · Cherry tomatoes – 50 g · Almonds – 20 g (toasted) · Olive oil – 1 tbsp",
    "image": "/images/dishes/almond-chicken-salad.jpg",
    "price": 15500,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 26,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 320
    },
    "ingredients": [
      "Grilled chicken breast – 120 g (cubed)",
      "Lettuce – 50 g",
      "Cucumber – 40 g (sliced)",
      "Cherry tomatoes – 50 g",
      "Almonds – 20 g (toasted)",
      "Olive oil – 1 tbsp",
      "Lemon juice – 1 tbsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Tree Nuts"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 10,
    "slug": "amaranth-porridge-with-blueberry-sauce",
    "imageIngredient": "/images/dishes/amaranth-porridge-with-blueberry-sauce-ingredient.jpg",
    "imageDelivered": "/images/dishes/amaranth-porridge-with-blueberry-sauce-delivered.jpg",
    "imagePackaging": "/images/dishes/amaranth-porridge-with-blueberry-sauce-packaging.jpg",
    "imageLifestyle": "/images/dishes/amaranth-porridge-with-blueberry-sauce-lifestyle.jpg",
    "name": "Amaranth Porridge with Blueberry Sauce",
    "description": "Amaranth seeds, Almond milk, Honey, and more.",
    "longDescription": "Amaranth seeds – 50 g · Almond milk – 200 ml · Honey – 1 tsp · Blueberries – 50 g (fresh/frozen) · Lemon juice – ½ tsp · Cinnamon powder – a pinch",
    "image": "/images/dishes/amaranth-porridge.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Amaranth seeds – 50 g",
      "Almond milk – 200 ml",
      "Honey – 1 tsp",
      "Blueberries – 50 g (fresh/frozen)",
      "Lemon juice – ½ tsp",
      "Cinnamon powder – a pinch"
    ],
    "allergens": [
      "Dairy",
      "Tree Nuts"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 11,
    "slug": "antioxidant-detox",
    "imageIngredient": "/images/dishes/antioxidant-detox-ingredient.jpg",
    "imageDelivered": "/images/dishes/antioxidant-detox-delivered.jpg",
    "imagePackaging": "/images/dishes/antioxidant-detox-packaging.jpg",
    "imageLifestyle": "/images/dishes/antioxidant-detox-lifestyle.jpg",
    "name": "Antioxidant Detox",
    "description": "Spinach, Cucumber, Green apple, and more.",
    "longDescription": "Spinach – 30 g · Cucumber – 50 g · Green apple – 1 small · Lemon juice – 1 tbsp · Ginger – ½ inch · Water – 150 ml",
    "image": "/images/dishes/antioxidant-detox.jpg",
    "price": 17000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Spinach – 30 g",
      "Cucumber – 50 g",
      "Green apple – 1 small",
      "Lemon juice – 1 tbsp",
      "Ginger – ½ inch",
      "Water – 150 ml",
      "Ice – 3–4 cubes"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 12,
    "slug": "apple-cinnamon-smoothie",
    "imageIngredient": "/images/dishes/apple-cinnamon-smoothie-ingredient.jpg",
    "imageDelivered": "/images/dishes/apple-cinnamon-smoothie-delivered.jpg",
    "imagePackaging": "/images/dishes/apple-cinnamon-smoothie-packaging.jpg",
    "imageLifestyle": "/images/dishes/apple-cinnamon-smoothie-lifestyle.jpg",
    "name": "Apple Cinnamon Smoothie",
    "description": "Apple, Almond milk, Oats, and more.",
    "longDescription": "Apple – 1 medium (peeled & chopped) · Almond milk – 200 ml · Oats – 2 tbsp (soaked) · Cinnamon powder – ¼ tsp · Honey – 1 tsp · Ice cubes – 3–4",
    "image": "/images/dishes/apple-cinnamon-smoothie.jpg",
    "price": 15000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Apple – 1 medium (peeled & chopped)",
      "Almond milk – 200 ml",
      "Oats – 2 tbsp (soaked)",
      "Cinnamon powder – ¼ tsp",
      "Honey – 1 tsp",
      "Ice cubes – 3–4"
    ],
    "allergens": [
      "Dairy",
      "Tree Nuts"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 13,
    "slug": "arrabbiata-veg",
    "imageIngredient": "/images/dishes/arrabbiata-veg-ingredient.jpg",
    "imageDelivered": "/images/dishes/arrabbiata-veg-delivered.jpg",
    "imagePackaging": "/images/dishes/arrabbiata-veg-packaging.jpg",
    "imageLifestyle": "/images/dishes/arrabbiata-veg-lifestyle.jpg",
    "name": "Arrabbiata - Veg",
    "description": "Penne pasta, Olive oil, Garlic, and more.",
    "longDescription": "Penne pasta – 120 g (boiled) · Olive oil – 1 tbsp · Garlic – 5 g (chopped) · Tomato puree – 100 g · Chili flakes – ½ tsp · Mixed veggies (zucchini, bell peppers, broccoli) – 70 g",
    "image": "/images/dishes/arrabbiata-veg.jpg",
    "price": 12500,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 14,
      "carbs": 65,
      "fat": 18,
      "fiber": 5,
      "calories": 480
    },
    "ingredients": [
      "Penne pasta – 120 g (boiled)",
      "Olive oil – 1 tbsp",
      "Garlic – 5 g (chopped)",
      "Tomato puree – 100 g",
      "Chili flakes – ½ tsp",
      "Mixed veggies (zucchini, bell peppers, broccoli) – 70 g",
      "Salt – to taste",
      "Basil – 1 tsp (chopped)"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 14,
    "slug": "arrabbiata-chicken",
    "imageIngredient": "/images/dishes/arrabbiata-chicken-ingredient.jpg",
    "imageDelivered": "/images/dishes/arrabbiata-chicken-delivered.jpg",
    "imagePackaging": "/images/dishes/arrabbiata-chicken-packaging.jpg",
    "imageLifestyle": "/images/dishes/arrabbiata-chicken-lifestyle.jpg",
    "name": "Arrabbiata - Chicken",
    "description": "Penne pasta, Olive oil, Garlic, and more.",
    "longDescription": "Penne pasta – 120 g (boiled) · Olive oil – 1 tbsp · Garlic – 5 g · Tomato puree – 100 g · Chili flakes – ½ tsp · Grilled chicken – 100 g (sliced)",
    "image": "/images/dishes/arrabbiata-chicken.jpg",
    "price": 17500,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 18,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Penne pasta – 120 g (boiled)",
      "Olive oil – 1 tbsp",
      "Garlic – 5 g",
      "Tomato puree – 100 g",
      "Chili flakes – ½ tsp",
      "Grilled chicken – 100 g (sliced)",
      "Salt – to taste",
      "Basil – 1 tsp"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 15,
    "slug": "arrabbiata-prawns",
    "imageIngredient": "/images/dishes/arrabbiata-prawns-ingredient.jpg",
    "imageDelivered": "/images/dishes/arrabbiata-prawns-delivered.jpg",
    "imagePackaging": "/images/dishes/arrabbiata-prawns-packaging.jpg",
    "imageLifestyle": "/images/dishes/arrabbiata-prawns-lifestyle.jpg",
    "name": "Arrabbiata - Prawns",
    "description": "Penne pasta, Olive oil, Garlic, and more.",
    "longDescription": "Penne pasta – 120 g (boiled) · Olive oil – 1 tbsp · Garlic – 5 g · Tomato puree – 100 g · Chili flakes – ½ tsp · Prawns – 6–8 medium (cleaned)",
    "image": "/images/dishes/arrabbiata-prawns.jpg",
    "price": 16000,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 18,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Penne pasta – 120 g (boiled)",
      "Olive oil – 1 tbsp",
      "Garlic – 5 g",
      "Tomato puree – 100 g",
      "Chili flakes – ½ tsp",
      "Prawns – 6–8 medium (cleaned)",
      "Salt – to taste",
      "Basil – 1 tsp"
    ],
    "allergens": [
      "Gluten",
      "Shellfish"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 16,
    "slug": "avocado-toast",
    "imageIngredient": "/images/dishes/avocado-toast-ingredient.jpg",
    "imageDelivered": "/images/dishes/avocado-toast-delivered.jpg",
    "imagePackaging": "/images/dishes/avocado-toast-packaging.jpg",
    "imageLifestyle": "/images/dishes/avocado-toast-lifestyle.jpg",
    "name": "Avocado Toast",
    "description": "Whole grain bread, Avocado, Lemon juice, and more.",
    "longDescription": "Whole grain bread – 2 slices · Avocado – 1 medium (mashed, ~100 g) · Lemon juice – ½ tsp · Salt & black pepper – to taste · Olive oil – 1 tsp",
    "image": "/images/dishes/avocado-toast.jpg",
    "price": 24000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 20,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Whole grain bread – 2 slices",
      "Avocado – 1 medium (mashed, ~100 g)",
      "Lemon juice – ½ tsp",
      "Salt & black pepper – to taste",
      "Olive oil – 1 tsp"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 17,
    "slug": "avocado-toast-with-poached-boiled-egg",
    "imageIngredient": "/images/dishes/avocado-toast-with-poached-boiled-egg-ingredient.jpg",
    "imageDelivered": "/images/dishes/avocado-toast-with-poached-boiled-egg-delivered.jpg",
    "imagePackaging": "/images/dishes/avocado-toast-with-poached-boiled-egg-packaging.jpg",
    "imageLifestyle": "/images/dishes/avocado-toast-with-poached-boiled-egg-lifestyle.jpg",
    "name": "Avocado Toast with Poached Boiled Egg",
    "description": "Whole grain bread, Avocado, Lemon juice, and more.",
    "longDescription": "Whole grain bread – 2 slices · Avocado – 100 g (mashed) · Lemon juice – ½ tsp · Poached egg – 1 · Salt, pepper – to taste",
    "image": "/images/dishes/avocado-toast-boiled-egg.jpg",
    "price": 28000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 20,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Whole grain bread – 2 slices",
      "Avocado – 100 g (mashed)",
      "Lemon juice – ½ tsp",
      "Poached egg – 1",
      "Salt, pepper – to taste"
    ],
    "allergens": [
      "Eggs",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 18,
    "slug": "avocado-toast-with-sunny-side-up",
    "imageIngredient": "/images/dishes/avocado-toast-with-sunny-side-up-ingredient.jpg",
    "imageDelivered": "/images/dishes/avocado-toast-with-sunny-side-up-delivered.jpg",
    "imagePackaging": "/images/dishes/avocado-toast-with-sunny-side-up-packaging.jpg",
    "imageLifestyle": "/images/dishes/avocado-toast-with-sunny-side-up-lifestyle.jpg",
    "name": "Avocado Toast with Sunny Side Up",
    "description": "Whole grain bread, Avocado, Lemon juice, and more.",
    "longDescription": "Whole grain bread – 2 slices · Avocado – 100 g · Lemon juice – ½ tsp · Egg – 1 (fried sunny side up) · Salt & pepper – to taste",
    "image": "/images/dishes/avocado-toast-sunny-side-up.jpg",
    "price": 28000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 20,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Whole grain bread – 2 slices",
      "Avocado – 100 g",
      "Lemon juice – ½ tsp",
      "Egg – 1 (fried sunny side up)",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Eggs",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 19,
    "slug": "barbeque-chicken-burrito-wrap",
    "imageIngredient": "/images/dishes/barbeque-chicken-burrito-wrap-ingredient.jpg",
    "imageDelivered": "/images/dishes/barbeque-chicken-burrito-wrap-delivered.jpg",
    "imagePackaging": "/images/dishes/barbeque-chicken-burrito-wrap-packaging.jpg",
    "imageLifestyle": "/images/dishes/barbeque-chicken-burrito-wrap-lifestyle.jpg",
    "name": "Barbeque Chicken Burrito Wrap",
    "description": "Whole wheat tortilla, Grilled chicken, BBQ sauce, and more.",
    "longDescription": "Whole wheat tortilla – 1 large · Grilled chicken – 100 g (shredded) · BBQ sauce – 2 tbsp · Bell peppers & onions – 50 g (sautéed) · Lettuce – 20 g · Cheese – 20 g (optional)",
    "image": "/images/dishes/barbeque-chicken-burrito-wrap.jpg",
    "price": 16000,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 18,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Whole wheat tortilla – 1 large",
      "Grilled chicken – 100 g (shredded)",
      "BBQ sauce – 2 tbsp",
      "Bell peppers & onions – 50 g (sautéed)",
      "Lettuce – 20 g",
      "Cheese – 20 g (optional)"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 20,
    "slug": "barbeque-grilled-chicken-rice-bowl",
    "imageIngredient": "/images/dishes/barbeque-grilled-chicken-rice-bowl-ingredient.jpg",
    "imageDelivered": "/images/dishes/barbeque-grilled-chicken-rice-bowl-delivered.jpg",
    "imagePackaging": "/images/dishes/barbeque-grilled-chicken-rice-bowl-packaging.jpg",
    "imageLifestyle": "/images/dishes/barbeque-grilled-chicken-rice-bowl-lifestyle.jpg",
    "name": "Barbeque Grilled Chicken Rice Bowl",
    "description": "Brown rice, Grilled chicken, BBQ sauce, and more.",
    "longDescription": "Brown rice – 150 g (cooked) · Grilled chicken – 120 g · BBQ sauce – 2 tbsp · Steamed broccoli & carrots – 70 g · Olive oil – 1 tsp · Salt & pepper – to taste",
    "image": "/images/dishes/barbeque-grilled-chicken-rice-bowl.jpg",
    "price": 17000,
    "kitchen": "continental",
    "category": "bowls",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 34,
      "carbs": 60,
      "fat": 14,
      "fiber": 7,
      "calories": 540
    },
    "ingredients": [
      "Brown rice – 150 g (cooked)",
      "Grilled chicken – 120 g",
      "BBQ sauce – 2 tbsp",
      "Steamed broccoli & carrots – 70 g",
      "Olive oil – 1 tsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 21,
    "slug": "barbeque-paneer-fiesta-rice-bowl",
    "name": "Barbeque Paneer Fiesta Rice Bowl",
    "description": "Brown rice, Paneer, BBQ sauce, and more.",
    "longDescription": "Brown rice – 150 g (cooked) · Paneer – 120 g (grilled cubes) · BBQ sauce – 2 tbsp · Veggies (broccoli, zucchini, bell peppers) – 70 g · Olive oil – 1 tsp",
    "image": "/images/dishes/barbeque-paneer-fiesta-rice-bowl.jpg",
    "price": 16500,
    "kitchen": "indian",
    "category": "bowls",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 60,
      "fat": 18,
      "fiber": 7,
      "calories": 460
    },
    "ingredients": [
      "Brown rice – 150 g (cooked)",
      "Paneer – 120 g (grilled cubes)",
      "BBQ sauce – 2 tbsp",
      "Veggies (broccoli, zucchini, bell peppers) – 70 g",
      "Olive oil – 1 tsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 22,
    "slug": "blueberry-smoothie",
    "name": "Blueberry Smoothie",
    "description": "Blueberries, Banana, Yogurt / almond milk, and more.",
    "longDescription": "Blueberries – 70 g (fresh/frozen) · Banana – 1 small (50 g) · Yogurt / almond milk – 200 ml · Honey – 1 tsp · Ice cubes – 3–4",
    "image": "/images/dishes/blueberry-smoothie.jpg",
    "price": 23000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Blueberries – 70 g (fresh/frozen)",
      "Banana – 1 small (50 g)",
      "Yogurt / almond milk – 200 ml",
      "Honey – 1 tsp",
      "Ice cubes – 3–4"
    ],
    "allergens": [
      "Dairy",
      "Tree Nuts"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 23,
    "slug": "broccoli-almond-soup",
    "name": "Broccoli Almond Soup",
    "description": "Broccoli, Almonds, Onion, and more.",
    "longDescription": "Broccoli – 100 g (florets) · Almonds – 10 pcs (soaked & peeled) · Onion – 20 g (chopped) · Garlic – 5 g · Olive oil – 1 tsp · Veg stock / water – 200 ml",
    "image": "/images/dishes/broccoli-almond-soup.jpg",
    "price": 9500,
    "kitchen": "continental",
    "category": "soups",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 6,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Broccoli – 100 g (florets)",
      "Almonds – 10 pcs (soaked & peeled)",
      "Onion – 20 g (chopped)",
      "Garlic – 5 g",
      "Olive oil – 1 tsp",
      "Veg stock / water – 200 ml",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Tree Nuts"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 24,
    "slug": "broccoli-babycorn-tomato-salad",
    "name": "Broccoli Babycorn Tomato Salad",
    "description": "Broccoli, Babycorn, Cherry tomatoes, and more.",
    "longDescription": "Broccoli – 80 g · Babycorn – 60 g (blanched) · Cherry tomatoes – 50 g · Olive oil – 1 tbsp · Lemon juice – ½ tbsp · Salt & pepper – to taste",
    "image": "/images/dishes/broccoli-babycorn-tomato-salad.jpg",
    "price": 10000,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Broccoli – 80 g",
      "Babycorn – 60 g (blanched)",
      "Cherry tomatoes – 50 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – ½ tbsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 25,
    "slug": "broccoli-lemon-chicken-salad",
    "name": "Broccoli Lemon Chicken Salad",
    "description": "Grilled chicken, Broccoli, Lettuce, and more.",
    "longDescription": "Grilled chicken – 120 g · Broccoli – 80 g (steamed) · Lettuce – 40 g · Olive oil – 1 tbsp · Lemon juice – 1 tbsp · Salt & pepper – to taste",
    "image": "/images/dishes/broccoli-lemon-chicken-salad.jpg",
    "price": 15500,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 26,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 320
    },
    "ingredients": [
      "Grilled chicken – 120 g",
      "Broccoli – 80 g (steamed)",
      "Lettuce – 40 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – 1 tbsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 26,
    "slug": "cheese-omelette",
    "name": "Cheese Omelette",
    "description": "Eggs, Milk, Cheese, and more.",
    "longDescription": "Eggs – 2 · Milk – 20 ml · Cheese – 20 g (grated) · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/cheese-omelette.jpg",
    "price": 8500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 18,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Milk – 20 ml",
      "Cheese – 20 g (grated)",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 27,
    "slug": "cheese-tomato-omelette",
    "name": "Cheese Tomato Omelette",
    "description": "Eggs, Tomato, Cheese, and more.",
    "longDescription": "Eggs – 2 · Tomato – 40 g (chopped) · Cheese – 20 g · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/cheese-tomato-omelette.jpg",
    "price": 8500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 18,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Tomato – 40 g (chopped)",
      "Cheese – 20 g",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 28,
    "slug": "cheesy-delight-nachos",
    "name": "Cheesy Delight Nachos",
    "description": "Nachos chips, Cheese sauce, Jalapeños, and more.",
    "longDescription": "Nachos chips – 100 g · Cheese sauce – 50 g · Jalapeños – 20 g · Salsa – 30 g · Sour cream – 20 g",
    "image": "/images/dishes/cheesy-delight-nachos.jpg",
    "price": 13000,
    "kitchen": "continental",
    "category": "snacks",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 6,
      "carbs": 30,
      "fat": 14,
      "fiber": 3,
      "calories": 240
    },
    "ingredients": [
      "Nachos chips – 100 g",
      "Cheese sauce – 50 g",
      "Jalapeños – 20 g",
      "Salsa – 30 g",
      "Sour cream – 20 g"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 29,
    "slug": "chia-lemonade-smoothie",
    "name": "Chia Lemonade Smoothie",
    "description": "Chia seeds, Lemon juice, Honey, and more.",
    "longDescription": "Chia seeds – 2 tsp (soaked in water 15 min) · Lemon juice – 1 tbsp · Honey – 1 tsp · Water – 200 ml · Ice cubes – 3–4",
    "image": "/images/dishes/chia-lemonade-smoothie.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Chia seeds – 2 tsp (soaked in water 15 min)",
      "Lemon juice – 1 tbsp",
      "Honey – 1 tsp",
      "Water – 200 ml",
      "Ice cubes – 3–4"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 30,
    "slug": "chicken-amigos-sandwich",
    "name": "Chicken Amigos Sandwich",
    "description": "Multigrain bread, Grilled chicken, Lettuce, and more.",
    "longDescription": "Multigrain bread – 2 slices · Grilled chicken – 100 g (sliced) · Lettuce – 20 g · Tomato – 30 g (sliced) · Cucumber – 20 g (sliced) · Ranch/mayo – 1 tbsp",
    "image": "/images/dishes/chicken-amigos-sandwich.jpg",
    "price": 14500,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Multigrain bread – 2 slices",
      "Grilled chicken – 100 g (sliced)",
      "Lettuce – 20 g",
      "Tomato – 30 g (sliced)",
      "Cucumber – 20 g (sliced)",
      "Ranch/mayo – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 31,
    "slug": "chicken-caesar-story-salad",
    "name": "Chicken Caesar Story Salad",
    "description": "Romaine lettuce, Grilled chicken, Croutons, and more.",
    "longDescription": "Romaine lettuce – 80 g · Grilled chicken – 120 g (sliced) · Croutons – 20 g · Parmesan – 15 g (shaved) · Caesar dressing – 2 tbsp",
    "image": "/images/dishes/chicken-caesar-story-salad.jpg",
    "price": 20000,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 26,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 320
    },
    "ingredients": [
      "Romaine lettuce – 80 g",
      "Grilled chicken – 120 g (sliced)",
      "Croutons – 20 g",
      "Parmesan – 15 g (shaved)",
      "Caesar dressing – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 32,
    "slug": "chicken-hummus-pita",
    "name": "Chicken Hummus Pita",
    "description": "Pita bread, Grilled chicken, Hummus, and more.",
    "longDescription": "Pita bread – 1 · Grilled chicken – 100 g (sliced) · Hummus – 2 tbsp · Lettuce, cucumber, tomato – 50 g (mixed)",
    "image": "/images/dishes/chicken-hummus-pita.jpg",
    "price": 13000,
    "kitchen": "mediterranean",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Pita bread – 1",
      "Grilled chicken – 100 g (sliced)",
      "Hummus – 2 tbsp",
      "Lettuce, cucumber, tomato – 50 g (mixed)"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 33,
    "slug": "chicken-pita-pockets-with-hummus",
    "name": "Chicken Pita Pockets with Hummus",
    "description": "Mini pita breads, Grilled chicken, Hummus, and more.",
    "longDescription": "Mini pita breads – 2 · Grilled chicken – 80 g · Hummus – 2 tbsp · Onion & cucumber – 40 g (sliced)",
    "image": "/images/dishes/chicken-pita-pockets-with-hummus.jpg",
    "price": 11500,
    "kitchen": "mediterranean",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Mini pita breads – 2",
      "Grilled chicken – 80 g",
      "Hummus – 2 tbsp",
      "Onion & cucumber – 40 g (sliced)"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 34,
    "slug": "chicken-tikka-sandwich-with-ranch-yoghurt",
    "name": "Chicken Tikka Sandwich with Ranch Yoghurt",
    "description": "Bread slices, Chicken tikka, Lettuce, and more.",
    "longDescription": "Bread slices – 2 · Chicken tikka – 100 g (boneless pieces) · Lettuce – 20 g · Onion rings – 20 g · Ranch yogurt dip – 2 tbsp",
    "image": "/images/dishes/chicken-tikka-sandwich-with-ranch-yoghurt.jpg",
    "price": 15500,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Bread slices – 2",
      "Chicken tikka – 100 g (boneless pieces)",
      "Lettuce – 20 g",
      "Onion rings – 20 g",
      "Ranch yogurt dip – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 35,
    "slug": "chickpea-peanut-tabbouleh-salad",
    "name": "Chickpea & Peanut Tabbouleh Salad",
    "description": "Boiled chickpeas, Peanuts, Parsley, and more.",
    "longDescription": "Boiled chickpeas – 80 g · Peanuts – 20 g (roasted) · Parsley – 20 g (chopped) · Tomato – 40 g (diced) · Lemon juice – 1 tbsp · Olive oil – 1 tbsp",
    "image": "/images/dishes/chickpea-peanut-tabbouleh-salad.jpg",
    "price": 7500,
    "kitchen": "mediterranean",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Boiled chickpeas – 80 g",
      "Peanuts – 20 g (roasted)",
      "Parsley – 20 g (chopped)",
      "Tomato – 40 g (diced)",
      "Lemon juice – 1 tbsp",
      "Olive oil – 1 tbsp",
      "Salt – to taste"
    ],
    "allergens": [
      "Peanuts"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 36,
    "slug": "chilli-chipotle-paneer-burrito-wrap",
    "name": "Chilli Chipotle Paneer Burrito Wrap",
    "description": "Tortilla, Paneer, Chipotle sauce, and more.",
    "longDescription": "Tortilla – 1 large · Paneer – 100 g (grilled cubes) · Chipotle sauce – 2 tbsp · Bell peppers & onion – 50 g (sautéed) · Lettuce – 20 g · Rice (optional) – 50 g",
    "image": "/images/dishes/chilli-chipotle-paneer-burrito-wrap.jpg",
    "price": 15000,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 18,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Tortilla – 1 large",
      "Paneer – 100 g (grilled cubes)",
      "Chipotle sauce – 2 tbsp",
      "Bell peppers & onion – 50 g (sautéed)",
      "Lettuce – 20 g",
      "Rice (optional) – 50 g"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 37,
    "slug": "chilli-chipotle-paneer-rice-bowl",
    "name": "Chilli Chipotle Paneer Rice Bowl",
    "description": "Brown rice, Paneer, Bell peppers & onion, and more.",
    "longDescription": "Brown rice – 150 g (cooked) · Paneer – 120 g (grilled, tossed in chipotle sauce) · Bell peppers & onion – 50 g · Lettuce – 20 g",
    "image": "/images/dishes/chilli-chipotle-paneer-rice-bowl.jpg",
    "price": 14000,
    "kitchen": "indian",
    "category": "bowls",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 60,
      "fat": 18,
      "fiber": 7,
      "calories": 460
    },
    "ingredients": [
      "Brown rice – 150 g (cooked)",
      "Paneer – 120 g (grilled, tossed in chipotle sauce)",
      "Bell peppers & onion – 50 g",
      "Lettuce – 20 g"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 38,
    "slug": "chipotle-chicken-burrito-wrap",
    "name": "Chipotle Chicken Burrito Wrap",
    "description": "Tortilla, Grilled chicken, Chipotle sauce, and more.",
    "longDescription": "Tortilla – 1 large · Grilled chicken – 120 g (sliced) · Chipotle sauce – 2 tbsp · Rice – 50 g (optional) · Onion & bell pepper – 40 g · Lettuce – 20 g",
    "image": "/images/dishes/chipotle-chicken-burrito-wrap.jpg",
    "price": 17000,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Tortilla – 1 large",
      "Grilled chicken – 120 g (sliced)",
      "Chipotle sauce – 2 tbsp",
      "Rice – 50 g (optional)",
      "Onion & bell pepper – 40 g",
      "Lettuce – 20 g"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 39,
    "slug": "chipotle-grilled-chicken-rice-bowl",
    "name": "Chipotle Grilled Chicken Rice Bowl",
    "description": "Brown rice, Grilled chicken, Chipotle sauce, and more.",
    "longDescription": "Brown rice – 150 g (cooked) · Grilled chicken – 120 g (sliced) · Chipotle sauce – 2 tbsp · Steamed veggies – 70 g",
    "image": "/images/dishes/chipotle-grilled-chicken-rice-bowl.jpg",
    "price": 14500,
    "kitchen": "continental",
    "category": "bowls",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 34,
      "carbs": 60,
      "fat": 14,
      "fiber": 7,
      "calories": 540
    },
    "ingredients": [
      "Brown rice – 150 g (cooked)",
      "Grilled chicken – 120 g (sliced)",
      "Chipotle sauce – 2 tbsp",
      "Steamed veggies – 70 g"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 40,
    "slug": "classic-bread-omelette-2-egg",
    "name": "Classic Bread Omelette (2 Egg)",
    "description": "Eggs, Bread slices, Onion, and more.",
    "longDescription": "Eggs – 2 · Bread slices – 2 · Onion – 20 g (chopped) · Green chili – 1 (chopped) · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/classic-bread-omelette-2-egg.jpg",
    "price": 6500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Bread slices – 2",
      "Onion – 20 g (chopped)",
      "Green chili – 1 (chopped)",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 41,
    "slug": "classic-nachos",
    "name": "Classic Nachos",
    "description": "Nachos chips, Salsa, Cheese sauce, and more.",
    "longDescription": "Nachos chips – 100 g · Salsa – 30 g · Cheese sauce – 50 g · Jalapeños – 20 g",
    "image": "/images/dishes/classic-nachos.jpg",
    "price": 11000,
    "kitchen": "continental",
    "category": "snacks",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 6,
      "carbs": 30,
      "fat": 14,
      "fiber": 3,
      "calories": 240
    },
    "ingredients": [
      "Nachos chips – 100 g",
      "Salsa – 30 g",
      "Cheese sauce – 50 g",
      "Jalapeños – 20 g"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 42,
    "slug": "classic-vegetable-poha",
    "name": "Classic Vegetable Poha",
    "description": "Flattened rice (poha), Onion, Tomato, and more.",
    "longDescription": "Flattened rice (poha) – 100 g · Onion – 30 g (chopped) · Tomato – 30 g (chopped) · Green chili – 1 · Curry leaves – 6–8 · Mustard seeds – ½ tsp",
    "image": "/images/dishes/classic-vegetable-poha.jpg",
    "price": 8000,
    "kitchen": "indian",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Flattened rice (poha) – 100 g",
      "Onion – 30 g (chopped)",
      "Tomato – 30 g (chopped)",
      "Green chili – 1",
      "Curry leaves – 6–8",
      "Mustard seeds – ½ tsp",
      "Oil – 1 tsp",
      "Salt – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 43,
    "slug": "coke-can",
    "name": "Coke Can",
    "description": "Chef-prepared beverages.",
    "longDescription": "",
    "image": "/images/dishes/coke-can.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": false,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [],
    "allergens": [],
    "glycaemicIndex": "high",
    "sugarPerServing": "35g (added)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 44,
    "slug": "cream-of-broccoli",
    "name": "Cream of Broccoli",
    "description": "Broccoli, Onion, Garlic, and more.",
    "longDescription": "Broccoli – 100 g · Onion – 20 g · Garlic – 5 g · Butter – 10 g · Milk/cream – 100 ml · Salt & pepper – to taste",
    "image": "/images/dishes/cream-of-broccoli.jpg",
    "price": 12500,
    "kitchen": "continental",
    "category": "soups",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 10,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Broccoli – 100 g",
      "Onion – 20 g",
      "Garlic – 5 g",
      "Butter – 10 g",
      "Milk/cream – 100 ml",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 45,
    "slug": "cream-of-chicken",
    "name": "Cream of Chicken",
    "description": "Chicken breast, Onion, Garlic, and more.",
    "longDescription": "Chicken breast – 120 g (boiled & shredded) · Onion – 20 g · Garlic – 5 g · Butter – 10 g · Milk/cream – 100 ml · Salt & pepper – to taste",
    "image": "/images/dishes/cream-of-chicken.jpg",
    "price": 16000,
    "kitchen": "continental",
    "category": "soups",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 10,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Chicken breast – 120 g (boiled & shredded)",
      "Onion – 20 g",
      "Garlic – 5 g",
      "Butter – 10 g",
      "Milk/cream – 100 ml",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 46,
    "slug": "cream-of-mushroom",
    "name": "Cream of Mushroom",
    "description": "Button mushrooms, Onion, Garlic, and more.",
    "longDescription": "Button mushrooms – 100 g (sliced) · Onion – 20 g · Garlic – 5 g · Butter – 10 g · Milk/cream – 100 ml · Salt & pepper – to taste",
    "image": "/images/dishes/cream-of-mushroom.jpg",
    "price": 14500,
    "kitchen": "continental",
    "category": "soups",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 10,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Button mushrooms – 100 g (sliced)",
      "Onion – 20 g",
      "Garlic – 5 g",
      "Butter – 10 g",
      "Milk/cream – 100 ml",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 47,
    "slug": "creamy-egg-white-sandwich",
    "name": "Creamy Egg White Sandwich",
    "description": "Egg whites, Multigrain bread, Yogurt dressing, and more.",
    "longDescription": "Egg whites – 3 (boiled, chopped) · Multigrain bread – 2 slices · Yogurt dressing – 1 tbsp · Lettuce – 20 g · Salt & pepper – to taste",
    "image": "/images/dishes/creamy-egg-white-sandwich.jpg",
    "price": 12500,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Egg whites – 3 (boiled, chopped)",
      "Multigrain bread – 2 slices",
      "Yogurt dressing – 1 tbsp",
      "Lettuce – 20 g",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Eggs",
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 48,
    "slug": "crispy-mushroom-burrito-wrap",
    "name": "Crispy Mushroom Burrito Wrap",
    "description": "Tortilla, Mushrooms, Lettuce, and more.",
    "longDescription": "Tortilla – 1 large · Mushrooms – 100 g (battered & fried) · Lettuce – 20 g · Bell peppers – 40 g · Salsa – 2 tbsp · Cheese – 20 g",
    "image": "/images/dishes/crispy-mushroom-burrito-wrap.jpg",
    "price": 19000,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 18,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Tortilla – 1 large",
      "Mushrooms – 100 g (battered & fried)",
      "Lettuce – 20 g",
      "Bell peppers – 40 g",
      "Salsa – 2 tbsp",
      "Cheese – 20 g"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 49,
    "slug": "crispy-mushroom-rice-bowl",
    "name": "Crispy Mushroom Rice Bowl",
    "description": "Brown rice, Mushrooms, Bell peppers & onion, and more.",
    "longDescription": "Brown rice – 150 g (cooked) · Mushrooms – 120 g (battered & fried) · Bell peppers & onion – 50 g (sautéed) · Lettuce – 20 g · Sauce/dip of choice – 2 tbsp",
    "image": "/images/dishes/crispy-mushroom-rice-bowl.jpg",
    "price": 19000,
    "kitchen": "continental",
    "category": "bowls",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 60,
      "fat": 14,
      "fiber": 7,
      "calories": 460
    },
    "ingredients": [
      "Brown rice – 150 g (cooked)",
      "Mushrooms – 120 g (battered & fried)",
      "Bell peppers & onion – 50 g (sautéed)",
      "Lettuce – 20 g",
      "Sauce/dip of choice – 2 tbsp"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 50,
    "slug": "crispy-peri-peri-chicken-burrito-wrap",
    "name": "Crispy Peri Peri Chicken Burrito Wrap",
    "description": "Tortilla, Chicken strips, Lettuce, and more.",
    "longDescription": "Tortilla – 1 large · Chicken strips – 120 g (fried, peri peri spiced) · Lettuce – 20 g · Onion & bell peppers – 50 g · Peri peri mayo/sauce – 2 tbsp",
    "image": "/images/dishes/crispy-peri-peri-chicken-burrito-wrap.jpg",
    "price": 23000,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Tortilla – 1 large",
      "Chicken strips – 120 g (fried, peri peri spiced)",
      "Lettuce – 20 g",
      "Onion & bell peppers – 50 g",
      "Peri peri mayo/sauce – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 51,
    "slug": "crispy-peri-peri-chicken-rice-bowl",
    "name": "Crispy Peri Peri Chicken Rice Bowl",
    "description": "Brown rice, Crispy peri peri chicken, Steamed vegetables, and more.",
    "longDescription": "Brown rice – 150 g (cooked) · Crispy peri peri chicken – 120 g · Steamed vegetables – 70 g · Peri peri mayo – 1 tbsp",
    "image": "/images/dishes/crispy-peri-peri-chicken-rice-bowl.jpg",
    "price": 22000,
    "kitchen": "continental",
    "category": "bowls",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 34,
      "carbs": 60,
      "fat": 14,
      "fiber": 7,
      "calories": 540
    },
    "ingredients": [
      "Brown rice – 150 g (cooked)",
      "Crispy peri peri chicken – 120 g",
      "Steamed vegetables – 70 g",
      "Peri peri mayo – 1 tbsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 52,
    "slug": "crispy-peri-peri-mushroom-burrito-wrap",
    "name": "Crispy Peri Peri Mushroom Burrito Wrap",
    "description": "Tortilla, Mushrooms, Bell peppers, and more.",
    "longDescription": "Tortilla – 1 large · Mushrooms – 120 g (crispy fried, peri peri spiced) · Bell peppers – 40 g · Lettuce – 20 g · Sauce – 2 tbsp",
    "image": "/images/dishes/crispy-peri-peri-mushroom-burrito-wrap.jpg",
    "price": 18500,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Tortilla – 1 large",
      "Mushrooms – 120 g (crispy fried, peri peri spiced)",
      "Bell peppers – 40 g",
      "Lettuce – 20 g",
      "Sauce – 2 tbsp"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 53,
    "slug": "crispy-peri-peri-mushroom-rice-bowl",
    "name": "Crispy Peri Peri Mushroom Rice Bowl",
    "description": "Brown rice, Crispy peri peri mushrooms, Veggies, and more.",
    "longDescription": "Brown rice – 150 g · Crispy peri peri mushrooms – 120 g · Veggies – 70 g · Sauce – 1 tbsp",
    "image": "/images/dishes/crispy-peri-peri-mushroom-rice-bowl.jpg",
    "price": 17500,
    "kitchen": "continental",
    "category": "bowls",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 60,
      "fat": 14,
      "fiber": 7,
      "calories": 460
    },
    "ingredients": [
      "Brown rice – 150 g",
      "Crispy peri peri mushrooms – 120 g",
      "Veggies – 70 g",
      "Sauce – 1 tbsp"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 54,
    "slug": "crispy-peri-peri-potato-rice-bowl",
    "name": "Crispy Peri Peri Potato Rice Bowl",
    "description": "Brown rice, Potato wedges, Onion, bell peppers, and more.",
    "longDescription": "Brown rice – 150 g · Potato wedges – 120 g (fried, peri peri spiced) · Onion, bell peppers – 50 g · Lettuce – 20 g",
    "image": "/images/dishes/crispy-peri-peri-potato-rice-bowl.jpg",
    "price": 22500,
    "kitchen": "continental",
    "category": "bowls",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 60,
      "fat": 14,
      "fiber": 7,
      "calories": 460
    },
    "ingredients": [
      "Brown rice – 150 g",
      "Potato wedges – 120 g (fried, peri peri spiced)",
      "Onion, bell peppers – 50 g",
      "Lettuce – 20 g"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 55,
    "slug": "dates-banana-smoothie",
    "name": "Dates Banana Smoothie",
    "description": "Banana, Dates, Almond milk, and more.",
    "longDescription": "Banana – 1 medium · Dates – 4 pcs (pitted) · Almond milk – 200 ml · Honey – 1 tsp · Ice cubes – 3–4",
    "image": "/images/dishes/dates-banana-smoothie.jpg",
    "price": 10500,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Banana – 1 medium",
      "Dates – 4 pcs (pitted)",
      "Almond milk – 200 ml",
      "Honey – 1 tsp",
      "Ice cubes – 3–4"
    ],
    "allergens": [
      "Dairy",
      "Tree Nuts"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 56,
    "slug": "diet-coke-can",
    "name": "Diet Coke Can",
    "description": "Diet Coke can.",
    "longDescription": "Diet Coke can – 1 (chilled)",
    "image": "/images/dishes/diet-coke-can.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": false,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Diet Coke can – 1 (chilled)"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "0g (artificial sweetener)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 57,
    "slug": "exotic-amaranth-blueberry-yogurt",
    "name": "Exotic Amaranth Blueberry Yogurt",
    "description": "Amaranth seeds, Yogurt, Blueberries, and more.",
    "longDescription": "Amaranth seeds – 50 g (cooked) · Yogurt – 100 g · Blueberries – 50 g · Honey – 1 tsp",
    "image": "/images/dishes/exotic-amaranth-blueberry-yogurt.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Amaranth seeds – 50 g (cooked)",
      "Yogurt – 100 g",
      "Blueberries – 50 g",
      "Honey – 1 tsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 58,
    "slug": "exotic-egg-bhurji",
    "name": "Exotic Egg Bhurji",
    "description": "Eggs, Onion, Tomato, and more.",
    "longDescription": "Eggs – 3 · Onion – 40 g (chopped) · Tomato – 40 g (chopped) · Green chili – 1 · Oil – 1 tsp · Salt & turmeric – to taste",
    "image": "/images/dishes/exotic-egg-bhurji.jpg",
    "price": 7500,
    "kitchen": "indian",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 3",
      "Onion – 40 g (chopped)",
      "Tomato – 40 g (chopped)",
      "Green chili – 1",
      "Oil – 1 tsp",
      "Salt & turmeric – to taste"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 59,
    "slug": "exotic-fruit-bowl",
    "name": "Exotic Fruit Bowl",
    "description": "Apple, Banana, Papaya, and more.",
    "longDescription": "Apple – 50 g · Banana – 50 g · Papaya – 50 g · Grapes – 30 g · Pomegranate – 30 g",
    "image": "/images/dishes/exotic-fruit-bowl.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Apple – 50 g",
      "Banana – 50 g",
      "Papaya – 50 g",
      "Grapes – 30 g",
      "Pomegranate – 30 g"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 60,
    "slug": "falafal-hummus-wrap",
    "name": "Falafal Hummus Wrap",
    "description": "Tortilla/pita, Falafel, Hummus, and more.",
    "longDescription": "Tortilla/pita – 1 · Falafel – 3 pcs · Hummus – 2 tbsp · Onion & tomato slices – 40 g · Lettuce – 20 g",
    "image": "/images/dishes/falafal-hummus-wrap.jpg",
    "price": 14500,
    "kitchen": "mediterranean",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Tortilla/pita – 1",
      "Falafel – 3 pcs",
      "Hummus – 2 tbsp",
      "Onion & tomato slices – 40 g",
      "Lettuce – 20 g"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 61,
    "slug": "falafal-pita-pockets-with-hummus",
    "name": "Falafal Pita Pockets with Hummus",
    "description": "Mini pita breads, Falafel, Hummus, and more.",
    "longDescription": "Mini pita breads – 2 · Falafel – 2 pcs each · Hummus – 1 tbsp each · Onion & cucumber – 30 g",
    "image": "/images/dishes/falafal-pita-pockets-with-hummus.jpg",
    "price": 14500,
    "kitchen": "mediterranean",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Mini pita breads – 2",
      "Falafel – 2 pcs each",
      "Hummus – 1 tbsp each",
      "Onion & cucumber – 30 g"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 62,
    "slug": "falafel-garden-salad",
    "name": "Falafel Garden Salad",
    "description": "Falafel, Lettuce, Tomato, and more.",
    "longDescription": "Falafel – 4 pcs (crumbled) · Lettuce – 50 g · Tomato – 40 g · Cucumber – 40 g · Olive oil – 1 tbsp · Lemon juice – ½ tbsp",
    "image": "/images/dishes/falafel-garden-salad.jpg",
    "price": 11000,
    "kitchen": "mediterranean",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Falafel – 4 pcs (crumbled)",
      "Lettuce – 50 g",
      "Tomato – 40 g",
      "Cucumber – 40 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – ½ tbsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 63,
    "slug": "french-omelette-sweet-savoury",
    "name": "French Omelette (Sweet/Savoury)",
    "description": "Eggs, Butter, Salt, and more.",
    "longDescription": "Eggs – 3 · Butter – 10 g · Salt – a pinch · Sugar – 1 tsp · Honey – 1 tsp · Cheese – 20 g",
    "image": "/images/dishes/french-omelette-sweet-savoury.jpg",
    "price": 10000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 18,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 3",
      "Butter – 10 g",
      "Salt – a pinch",
      "Sugar – 1 tsp",
      "Honey – 1 tsp",
      "Cheese – 20 g",
      "Herbs – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 64,
    "slug": "fruity-sprout-salad",
    "name": "Fruity Sprout Salad",
    "description": "Moong sprouts, Apple, Pomegranate, and more.",
    "longDescription": "Moong sprouts – 80 g · Apple – 40 g (chopped) · Pomegranate – 30 g · Orange segments – 30 g · Lemon juice – 1 tbsp · Salt & pepper – to taste",
    "image": "/images/dishes/fruity-sprout-salad.jpg",
    "price": 11000,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Moong sprouts – 80 g",
      "Apple – 40 g (chopped)",
      "Pomegranate – 30 g",
      "Orange segments – 30 g",
      "Lemon juice – 1 tbsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 65,
    "slug": "fruity-yogurt",
    "name": "Fruity Yogurt",
    "description": "Yogurt, Banana, Apple, and more.",
    "longDescription": "Yogurt – 100 g · Banana – 50 g (sliced) · Apple – 40 g (chopped) · Honey – 1 tsp",
    "image": "/images/dishes/fruity-yogurt.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Yogurt – 100 g",
      "Banana – 50 g (sliced)",
      "Apple – 40 g (chopped)",
      "Honey – 1 tsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 66,
    "slug": "greek-roman-chicken-salad",
    "name": "Greek Roman Chicken Salad",
    "description": "Grilled chicken, Cucumber, Tomato, and more.",
    "longDescription": "Grilled chicken – 120 g · Cucumber – 40 g · Tomato – 40 g · Olives – 20 g · Feta cheese – 20 g · Olive oil – 1 tbsp",
    "image": "/images/dishes/greek-roman-chicken-salad.jpg",
    "price": 19500,
    "kitchen": "mediterranean",
    "category": "salads",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 26,
      "carbs": 12,
      "fat": 18,
      "fiber": 6,
      "calories": 320
    },
    "ingredients": [
      "Grilled chicken – 120 g",
      "Cucumber – 40 g",
      "Tomato – 40 g",
      "Olives – 20 g",
      "Feta cheese – 20 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – 1 tbsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 67,
    "slug": "greek-roman-veg-salad",
    "name": "Greek Roman Veg Salad",
    "description": "Cucumber, Tomato, Onion, and more.",
    "longDescription": "Cucumber – 40 g · Tomato – 40 g · Onion – 30 g · Olives – 20 g · Feta cheese – 20 g · Olive oil – 1 tbsp",
    "image": "/images/dishes/greek-roman-veg-salad.jpg",
    "price": 11500,
    "kitchen": "mediterranean",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 18,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Cucumber – 40 g",
      "Tomato – 40 g",
      "Onion – 30 g",
      "Olives – 20 g",
      "Feta cheese – 20 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – 1 tbsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 68,
    "slug": "healthy-liver-juice",
    "name": "Healthy Liver Juice",
    "description": "Beetroot, Carrot, Apple, and more.",
    "longDescription": "Beetroot – 80 g · Carrot – 80 g · Apple – 50 g · Lemon juice – ½ tbsp · Ginger – ½ inch · Water – 150 ml",
    "image": "/images/dishes/healthy-liver-juice.jpg",
    "price": 5000,
    "kitchen": "indian",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Beetroot – 80 g",
      "Carrot – 80 g",
      "Apple – 50 g",
      "Lemon juice – ½ tbsp",
      "Ginger – ½ inch",
      "Water – 150 ml"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 69,
    "slug": "healthy-whole-wheat-tofu-wrap",
    "name": "Healthy Whole Wheat Tofu Wrap",
    "description": "Whole wheat tortilla, Tofu, Lettuce, and more.",
    "longDescription": "Whole wheat tortilla – 1 · Tofu – 100 g (grilled) · Lettuce – 20 g · Bell peppers & onion – 50 g · Yogurt dressing – 1 tbsp",
    "image": "/images/dishes/healthy-whole-wheat-tofu-wrap.jpg",
    "price": 14500,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Whole wheat tortilla – 1",
      "Tofu – 100 g (grilled)",
      "Lettuce – 20 g",
      "Bell peppers & onion – 50 g",
      "Yogurt dressing – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten",
      "Soy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 70,
    "slug": "healthy-whole-wheat-chicken-tikka-wrap",
    "name": "Healthy Whole Wheat Chicken Tikka Wrap",
    "description": "Whole wheat tortilla, Chicken tikka, Onion rings, and more.",
    "longDescription": "Whole wheat tortilla – 1 · Chicken tikka – 120 g · Onion rings – 20 g · Lettuce – 20 g · Ranch yogurt/mint chutney – 2 tbsp",
    "image": "/images/dishes/healthy-whole-wheat-chicken-tikka-wrap.jpg",
    "price": 15500,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 460
    },
    "ingredients": [
      "Whole wheat tortilla – 1",
      "Chicken tikka – 120 g",
      "Onion rings – 20 g",
      "Lettuce – 20 g",
      "Ranch yogurt/mint chutney – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 71,
    "slug": "healthy-whole-wheat-paneer-wrap",
    "name": "Healthy Whole Wheat Paneer Wrap",
    "description": "Whole wheat tortilla, Paneer tikka, Onion rings, and more.",
    "longDescription": "Whole wheat tortilla – 1 · Paneer tikka – 120 g · Onion rings – 20 g · Lettuce – 20 g · Mint chutney – 2 tbsp",
    "image": "/images/dishes/healthy-whole-wheat-paneer-wrap.jpg",
    "price": 15500,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 18,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Whole wheat tortilla – 1",
      "Paneer tikka – 120 g",
      "Onion rings – 20 g",
      "Lettuce – 20 g",
      "Mint chutney – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 72,
    "slug": "high-protein-chicken-omelette",
    "name": "High Protein Chicken Omelette",
    "description": "Eggs, Grilled chicken, Onion, and more.",
    "longDescription": "Eggs – 3 · Grilled chicken – 80 g (shredded) · Onion – 20 g · Tomato – 20 g · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/high-protein-chicken-omelette.jpg",
    "price": 12500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 3",
      "Grilled chicken – 80 g (shredded)",
      "Onion – 20 g",
      "Tomato – 20 g",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 73,
    "slug": "hot-n-sour-soup-veg",
    "name": "Hot n Sour Soup (Veg)",
    "description": "Mixed veggies (cabbage, carrot, beans), Garlic, Soy sauce, and more.",
    "longDescription": "Mixed veggies (cabbage, carrot, beans) – 80 g · Garlic – 5 g (chopped) · Soy sauce – 1 tsp · Vinegar – 1 tsp · Cornstarch slurry – 1 tbsp · Chili paste – ½ tsp",
    "image": "/images/dishes/hot-n-sour-soup-veg.jpg",
    "price": 9500,
    "kitchen": "asian",
    "category": "soups",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 6,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Mixed veggies (cabbage, carrot, beans) – 80 g",
      "Garlic – 5 g (chopped)",
      "Soy sauce – 1 tsp",
      "Vinegar – 1 tsp",
      "Cornstarch slurry – 1 tbsp",
      "Chili paste – ½ tsp",
      "Veg stock – 200 ml",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Soy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 74,
    "slug": "hot-n-sour-soup-chicken",
    "name": "Hot n Sour Soup (Chicken)",
    "description": "Chicken, Garlic, Soy sauce, and more.",
    "longDescription": "Chicken – 100 g (shredded, boiled) · Garlic – 5 g · Soy sauce – 1 tsp · Vinegar – 1 tsp · Chili paste – ½ tsp · Cornstarch slurry – 1 tbsp",
    "image": "/images/dishes/hot-n-sour-soup-chicken.jpg",
    "price": 9500,
    "kitchen": "asian",
    "category": "soups",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 6,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Chicken – 100 g (shredded, boiled)",
      "Garlic – 5 g",
      "Soy sauce – 1 tsp",
      "Vinegar – 1 tsp",
      "Chili paste – ½ tsp",
      "Cornstarch slurry – 1 tbsp",
      "Chicken stock – 200 ml",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Soy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 75,
    "slug": "hummus-pita-classic",
    "name": "Hummus Pita Classic",
    "description": "Pita bread, Hummus, Olive oil, and more.",
    "longDescription": "Pita bread – 1 · Hummus – 3 tbsp · Olive oil – 1 tsp · Paprika – a pinch",
    "image": "/images/dishes/hummus-pita-classic.jpg",
    "price": 5000,
    "kitchen": "mediterranean",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Pita bread – 1",
      "Hummus – 3 tbsp",
      "Olive oil – 1 tsp",
      "Paprika – a pinch"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 76,
    "slug": "hummus-pita-with-falafel",
    "name": "Hummus Pita with Falafel",
    "description": "Pita bread, Falafel, Hummus, and more.",
    "longDescription": "Pita bread – 1 · Falafel – 3 pcs · Hummus – 3 tbsp · Onion & tomato slices – 40 g",
    "image": "/images/dishes/hummus-pita-with-falafel.jpg",
    "price": 14500,
    "kitchen": "mediterranean",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Pita bread – 1",
      "Falafel – 3 pcs",
      "Hummus – 3 tbsp",
      "Onion & tomato slices – 40 g"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 77,
    "slug": "hydrating-watermelon-juice",
    "name": "Hydrating Watermelon Juice",
    "description": "Watermelon cubes, Lemon juice, Mint leaves, and more.",
    "longDescription": "Watermelon cubes – 200 g · Lemon juice – ½ tbsp · Mint leaves – 4–5 · Ice cubes – 3–4",
    "image": "/images/dishes/hydrating-watermelon-juice.jpg",
    "price": 5000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Watermelon cubes – 200 g",
      "Lemon juice – ½ tbsp",
      "Mint leaves – 4–5",
      "Ice cubes – 3–4"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 78,
    "slug": "lebanese-hummus-salad",
    "name": "Lebanese Hummus Salad",
    "description": "Hummus, Chickpeas, Tomato, and more.",
    "longDescription": "Hummus – 3 tbsp · Chickpeas – 50 g (boiled) · Tomato – 40 g (diced) · Cucumber – 40 g (diced) · Olive oil – 1 tbsp · Lemon juice – ½ tbsp",
    "image": "/images/dishes/lebanese-hummus-salad.jpg",
    "price": 6000,
    "kitchen": "mediterranean",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Hummus – 3 tbsp",
      "Chickpeas – 50 g (boiled)",
      "Tomato – 40 g (diced)",
      "Cucumber – 40 g (diced)",
      "Olive oil – 1 tbsp",
      "Lemon juice – ½ tbsp"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 79,
    "slug": "lemon-mint-ice-tea-smoothie",
    "name": "Lemon Mint Ice Tea Smoothie",
    "description": "Green tea (brewed & cooled), Lemon juice, Fresh mint, and more.",
    "longDescription": "Green tea (brewed & cooled) – 200 ml · Lemon juice – 1 tbsp · Fresh mint – 6–7 leaves · Honey – 1 tsp · Ice cubes – 4–5",
    "image": "/images/dishes/lemon-mint-ice-tea-smoothie.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Green tea (brewed & cooled) – 200 ml",
      "Lemon juice – 1 tbsp",
      "Fresh mint – 6–7 leaves",
      "Honey – 1 tsp",
      "Ice cubes – 4–5"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 80,
    "slug": "manchow-soup-veg",
    "name": "Manchow Soup (Veg)",
    "description": "Mixed veggies (cabbage, carrot, beans), Garlic, Ginger, and more.",
    "longDescription": "Mixed veggies (cabbage, carrot, beans) – 80 g · Garlic – 5 g · Ginger – 5 g · Soy sauce – 1 tsp · Vinegar – 1 tsp · Chili paste – ½ tsp",
    "image": "/images/dishes/manchow-soup-veg.jpg",
    "price": 9500,
    "kitchen": "asian",
    "category": "soups",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 6,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Mixed veggies (cabbage, carrot, beans) – 80 g",
      "Garlic – 5 g",
      "Ginger – 5 g",
      "Soy sauce – 1 tsp",
      "Vinegar – 1 tsp",
      "Chili paste – ½ tsp",
      "Cornstarch slurry – 1 tbsp",
      "Veg stock – 200 ml",
      "Fried noodles – 20 g (for garnish)"
    ],
    "allergens": [
      "Gluten",
      "Soy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 81,
    "slug": "manchow-soup-chicken",
    "name": "Manchow Soup (Chicken)",
    "description": "Chicken breast, Garlic, Ginger, and more.",
    "longDescription": "Chicken breast – 100 g (shredded, boiled) · Garlic – 5 g · Ginger – 5 g · Soy sauce – 1 tsp · Vinegar – 1 tsp · Chili paste – ½ tsp",
    "image": "/images/dishes/manchow-soup-chicken.jpg",
    "price": 9500,
    "kitchen": "asian",
    "category": "soups",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 6,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Chicken breast – 100 g (shredded, boiled)",
      "Garlic – 5 g",
      "Ginger – 5 g",
      "Soy sauce – 1 tsp",
      "Vinegar – 1 tsp",
      "Chili paste – ½ tsp",
      "Cornstarch slurry – 1 tbsp",
      "Chicken stock – 200 ml",
      "Fried noodles – 20 g"
    ],
    "allergens": [
      "Gluten",
      "Soy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 82,
    "slug": "masala-bread-omelette-2-egg",
    "name": "Masala Bread Omelette (2 Egg)",
    "description": "Eggs, Onion, Tomato, and more.",
    "longDescription": "Eggs – 2 · Onion – 20 g (chopped) · Tomato – 20 g (chopped) · Green chili – 1 · Coriander leaves – 1 tsp · Bread slices – 2",
    "image": "/images/dishes/masala-bread-omelette-2-egg.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Onion – 20 g (chopped)",
      "Tomato – 20 g (chopped)",
      "Green chili – 1",
      "Coriander leaves – 1 tsp",
      "Bread slices – 2",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 83,
    "slug": "millets-bread-loaf",
    "name": "Millets Bread Loaf",
    "description": "Millet flour, Whole wheat flour, Dry yeast, and more.",
    "longDescription": "Millet flour – 200 g · Whole wheat flour – 50 g · Dry yeast – 1 tsp · Warm water – 120 ml · Olive oil – 1 tbsp · Salt – ½ tsp",
    "image": "/images/dishes/millets-bread-loaf.jpg",
    "price": 11000,
    "kitchen": "indian",
    "category": "snacks",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 6,
      "carbs": 30,
      "fat": 10,
      "fiber": 3,
      "calories": 240
    },
    "ingredients": [
      "Millet flour – 200 g",
      "Whole wheat flour – 50 g",
      "Dry yeast – 1 tsp",
      "Warm water – 120 ml",
      "Olive oil – 1 tbsp",
      "Salt – ½ tsp"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 84,
    "slug": "millets-poha-barnyard",
    "name": "Millets Poha Barnyard",
    "description": "Barnyard millet poha, Onion, Tomato, and more.",
    "longDescription": "Barnyard millet poha – 100 g · Onion – 30 g · Tomato – 30 g · Green chili – 1 · Curry leaves – 6–7 · Mustard seeds – ½ tsp",
    "image": "/images/dishes/millets-poha-barnyard.jpg",
    "price": 8000,
    "kitchen": "indian",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Barnyard millet poha – 100 g",
      "Onion – 30 g",
      "Tomato – 30 g",
      "Green chili – 1",
      "Curry leaves – 6–7",
      "Mustard seeds – ½ tsp",
      "Oil – 1 tsp",
      "Salt – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 85,
    "slug": "moong-dal-chilla-with-curd",
    "name": "Moong Dal Chilla with Curd",
    "description": "Moong dal, Ginger, Green chili, and more.",
    "longDescription": "Moong dal – 1 cup (soaked, ground) · Ginger – 1 tsp · Green chili – 1 · Salt – to taste · Oil – 1 tsp (for cooking) · Curd – 100 g (on side)",
    "image": "/images/dishes/moong-dal-chilla-with-curd.jpg",
    "price": 8500,
    "kitchen": "indian",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Moong dal – 1 cup (soaked, ground)",
      "Ginger – 1 tsp",
      "Green chili – 1",
      "Salt – to taste",
      "Oil – 1 tsp (for cooking)",
      "Curd – 100 g (on side)"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 86,
    "slug": "mushroom-omelette",
    "name": "Mushroom Omelette",
    "description": "Eggs, Mushrooms, Onion, and more.",
    "longDescription": "Eggs – 2 · Mushrooms – 50 g (sliced) · Onion – 20 g (chopped) · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/mushroom-omelette.jpg",
    "price": 9500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Mushrooms – 50 g (sliced)",
      "Onion – 20 g (chopped)",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 87,
    "slug": "nutella-toast-white-bread",
    "name": "Nutella Toast - White Bread",
    "description": "White bread, Nutella.",
    "longDescription": "White bread – 2 slices · Nutella – 2 tbsp",
    "image": "/images/dishes/nutella-toast-white-bread.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "White bread – 2 slices",
      "Nutella – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 88,
    "slug": "nutella-toast-brown-bread",
    "name": "Nutella Toast - Brown Bread",
    "description": "Brown bread, Nutella.",
    "longDescription": "Brown bread – 2 slices · Nutella – 2 tbsp",
    "image": "/images/dishes/nutella-toast-brown-bread.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Brown bread – 2 slices",
      "Nutella – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 89,
    "slug": "paneer-tikka-burrito-wrap",
    "name": "Paneer Tikka Burrito Wrap",
    "description": "Tortilla, Paneer tikka, Onion rings, and more.",
    "longDescription": "Tortilla – 1 · Paneer tikka – 120 g · Onion rings – 30 g · Lettuce – 20 g · Mint chutney – 2 tbsp",
    "image": "/images/dishes/paneer-tikka-burrito-wrap.jpg",
    "price": 17000,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 18,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Tortilla – 1",
      "Paneer tikka – 120 g",
      "Onion rings – 30 g",
      "Lettuce – 20 g",
      "Mint chutney – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 90,
    "slug": "peanut-butter-banana-smoothie",
    "name": "Peanut Butter Banana Smoothie",
    "description": "Banana, Peanut butter, Almond milk, and more.",
    "longDescription": "Banana – 1 medium · Peanut butter – 2 tbsp · Almond milk – 200 ml · Honey – 1 tsp · Ice cubes – 4",
    "image": "/images/dishes/peanut-butter-banana-smoothie.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Banana – 1 medium",
      "Peanut butter – 2 tbsp",
      "Almond milk – 200 ml",
      "Honey – 1 tsp",
      "Ice cubes – 4"
    ],
    "allergens": [
      "Dairy",
      "Peanuts",
      "Tree Nuts"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 91,
    "slug": "peri-peri-paneer-burrito-wrap",
    "name": "Peri Peri Paneer Burrito Wrap",
    "description": "Tortilla, Paneer, Lettuce, and more.",
    "longDescription": "Tortilla – 1 large · Paneer – 120 g (grilled, peri peri spiced) · Lettuce – 20 g · Onion & capsicum – 40 g · Peri peri mayo – 2 tbsp",
    "image": "/images/dishes/peri-peri-paneer-burrito-wrap.jpg",
    "price": 17000,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 18,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Tortilla – 1 large",
      "Paneer – 120 g (grilled, peri peri spiced)",
      "Lettuce – 20 g",
      "Onion & capsicum – 40 g",
      "Peri peri mayo – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 92,
    "slug": "peri-peri-paneer-fiesta-rice-bowl",
    "name": "Peri Peri Paneer Fiesta Rice Bowl",
    "description": "Brown rice, Paneer, Steamed veggies, and more.",
    "longDescription": "Brown rice – 150 g · Paneer – 120 g (peri peri grilled) · Steamed veggies – 70 g · Peri peri sauce – 2 tbsp",
    "image": "/images/dishes/peri-peri-paneer-fiesta-rice-bowl.jpg",
    "price": 16500,
    "kitchen": "indian",
    "category": "bowls",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 22,
      "carbs": 60,
      "fat": 18,
      "fiber": 7,
      "calories": 460
    },
    "ingredients": [
      "Brown rice – 150 g",
      "Paneer – 120 g (peri peri grilled)",
      "Steamed veggies – 70 g",
      "Peri peri sauce – 2 tbsp"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 93,
    "slug": "pesto-pasta-veg",
    "name": "Pesto Pasta (Veg)",
    "description": "Pasta, Basil pesto, Olive oil, and more.",
    "longDescription": "Pasta – 120 g (boiled) · Basil pesto – 2 tbsp · Olive oil – 1 tbsp · Zucchini, broccoli, capsicum – 70 g · Salt & pepper – to taste",
    "image": "/images/dishes/pesto-pasta-veg.jpg",
    "price": 16000,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 14,
      "carbs": 65,
      "fat": 18,
      "fiber": 5,
      "calories": 480
    },
    "ingredients": [
      "Pasta – 120 g (boiled)",
      "Basil pesto – 2 tbsp",
      "Olive oil – 1 tbsp",
      "Zucchini, broccoli, capsicum – 70 g",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 94,
    "slug": "pesto-pasta-chicken",
    "name": "Pesto Pasta (Chicken)",
    "description": "Pasta, Basil pesto, Olive oil, and more.",
    "longDescription": "Pasta – 120 g (boiled) · Basil pesto – 2 tbsp · Olive oil – 1 tbsp · Grilled chicken – 100 g (sliced) · Salt & pepper – to taste",
    "image": "/images/dishes/pesto-pasta-chicken.jpg",
    "price": 20500,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 18,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Pasta – 120 g (boiled)",
      "Basil pesto – 2 tbsp",
      "Olive oil – 1 tbsp",
      "Grilled chicken – 100 g (sliced)",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 95,
    "slug": "pesto-pasta-prawns",
    "name": "Pesto Pasta (Prawns)",
    "description": "Pasta, Basil pesto, Olive oil, and more.",
    "longDescription": "Pasta – 120 g (boiled) · Basil pesto – 2 tbsp · Olive oil – 1 tbsp · Prawns – 6–8 (cleaned) · Salt & pepper – to taste",
    "image": "/images/dishes/pesto-pasta-prawns.jpg",
    "price": 23000,
    "kitchen": "continental",
    "category": "pasta",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 28,
      "carbs": 65,
      "fat": 18,
      "fiber": 5,
      "calories": 580
    },
    "ingredients": [
      "Pasta – 120 g (boiled)",
      "Basil pesto – 2 tbsp",
      "Olive oil – 1 tbsp",
      "Prawns – 6–8 (cleaned)",
      "Salt & pepper – to taste"
    ],
    "allergens": [
      "Gluten",
      "Shellfish"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 96,
    "slug": "plain-omelette",
    "name": "Plain Omelette",
    "description": "Eggs, Salt & pepper, Oil.",
    "longDescription": "Eggs – 2 · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/plain-omelette.jpg",
    "price": 8500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 97,
    "slug": "power-house-smoothie",
    "name": "Power House Smoothie",
    "description": "Banana, Oats, Almonds, and more.",
    "longDescription": "Banana – 1 medium · Oats – 2 tbsp (soaked) · Almonds – 6 pcs (soaked) · Peanut butter – 1 tbsp · Whey protein – 1 scoop · Almond milk – 200 ml",
    "image": "/images/dishes/power-house-smoothie.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 15,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Banana – 1 medium",
      "Oats – 2 tbsp (soaked)",
      "Almonds – 6 pcs (soaked)",
      "Peanut butter – 1 tbsp",
      "Whey protein – 1 scoop",
      "Almond milk – 200 ml",
      "Ice cubes – 4"
    ],
    "allergens": [
      "Dairy",
      "Peanuts",
      "Tree Nuts"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 98,
    "slug": "quinoa-khichdi",
    "name": "Quinoa Khichdi",
    "description": "Quinoa, Moong dal, Onion, and more.",
    "longDescription": "Quinoa – 80 g (washed) · Moong dal – 40 g (washed) · Onion – 30 g (chopped) · Tomato – 30 g (chopped) · Ginger – 1 tsp (grated) · Green chili – 1",
    "image": "/images/dishes/quinoa-khichdi.jpg",
    "price": 7000,
    "kitchen": "indian",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Quinoa – 80 g (washed)",
      "Moong dal – 40 g (washed)",
      "Onion – 30 g (chopped)",
      "Tomato – 30 g (chopped)",
      "Ginger – 1 tsp (grated)",
      "Green chili – 1",
      "Curry leaves – 6–8",
      "Mustard seeds – ½ tsp",
      "Turmeric – ¼ tsp",
      "Salt – to taste",
      "Oil – 1 tsp",
      "Water – 300 ml"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 99,
    "slug": "quinoa-upma",
    "name": "Quinoa Upma",
    "description": "Quinoa, Onion, Tomato, and more.",
    "longDescription": "Quinoa – 80 g · Onion – 30 g · Tomato – 30 g · Green chili – 1 · Carrot & beans – 50 g (chopped) · Curry leaves – 6–8",
    "image": "/images/dishes/quinoa-upma.jpg",
    "price": 7500,
    "kitchen": "indian",
    "category": "breakfast",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 12,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 260
    },
    "ingredients": [
      "Quinoa – 80 g",
      "Onion – 30 g",
      "Tomato – 30 g",
      "Green chili – 1",
      "Carrot & beans – 50 g (chopped)",
      "Curry leaves – 6–8",
      "Mustard seeds – ½ tsp",
      "Oil – 1 tsp",
      "Salt – to taste",
      "Water – 250 ml"
    ],
    "allergens": [],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 100,
    "slug": "ragi-dates-eggless-brownie",
    "name": "Ragi Dates Eggless Brownie",
    "description": "Ragi flour, Whole wheat flour, Dates puree, and more.",
    "longDescription": "Ragi flour – 80 g · Whole wheat flour – 20 g · Dates puree – 50 g · Cocoa powder – 15 g · Baking powder – ½ tsp · Olive oil – 20 ml",
    "image": "/images/dishes/ragi-dates-eggless-brownie.jpg",
    "price": 11000,
    "kitchen": "indian",
    "category": "snacks",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "serveMode": "ready_ambient",
    "tasteDescription": "Fudgy ragi-and-cocoa bake, naturally sweetened with dates — cakey crumb, gently earthy, no refined sugar.",
    "macros": {
      "protein": 6,
      "carbs": 30,
      "fat": 10,
      "fiber": 3,
      "calories": 240
    },
    "ingredients": [
      "Ragi flour – 80 g",
      "Whole wheat flour – 20 g",
      "Dates puree – 50 g",
      "Cocoa powder – 15 g",
      "Baking powder – ½ tsp",
      "Olive oil – 20 ml",
      "Milk – 60 ml"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "high",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 101,
    "slug": "roast-chicken-russian",
    "name": "Roast Chicken Russian",
    "description": "Chicken breast, Onion, Capsicum, and more.",
    "longDescription": "Chicken breast – 150 g (roasted & sliced) · Onion – 30 g · Capsicum – 30 g · Carrot – 30 g · Ranch/mayo – 1 tbsp · Lettuce – 20 g",
    "image": "/images/dishes/roast-chicken-russian.jpg",
    "price": 14000,
    "kitchen": "continental",
    "category": "mains",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 36,
      "carbs": 30,
      "fat": 14,
      "fiber": 5,
      "calories": 460
    },
    "ingredients": [
      "Chicken breast – 150 g (roasted & sliced)",
      "Onion – 30 g",
      "Capsicum – 30 g",
      "Carrot – 30 g",
      "Ranch/mayo – 1 tbsp",
      "Lettuce – 20 g"
    ],
    "allergens": [
      "Dairy"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 102,
    "slug": "signature-quinoa-salad",
    "name": "Signature Quinoa Salad",
    "description": "Quinoa, Lettuce, Cucumber, and more.",
    "longDescription": "Quinoa – 80 g (cooked) · Lettuce – 40 g · Cucumber – 40 g · Tomato – 40 g · Pomegranate – 30 g · Olive oil – 1 tbsp",
    "image": "/images/dishes/signature-quinoa-salad.jpg",
    "price": 9000,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Quinoa – 80 g (cooked)",
      "Lettuce – 40 g",
      "Cucumber – 40 g",
      "Tomato – 40 g",
      "Pomegranate – 30 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – ½ tbsp",
      "Salt & pepper – to taste"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 103,
    "slug": "smoked-chicken-cheese-omelette",
    "name": "Smoked Chicken Cheese Omelette",
    "description": "Eggs, Smoked chicken, Cheese, and more.",
    "longDescription": "Eggs – 3 · Smoked chicken – 80 g (sliced) · Cheese – 20 g (grated) · Onion – 20 g (chopped) · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/smoked-chicken-cheese-omelette.jpg",
    "price": 17500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 18,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 3",
      "Smoked chicken – 80 g (sliced)",
      "Cheese – 20 g (grated)",
      "Onion – 20 g (chopped)",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Dairy"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 104,
    "slug": "smokey-chicken-salad",
    "name": "Smokey Chicken Salad",
    "description": "Smoked chicken, Lettuce, Cucumber, and more.",
    "longDescription": "Smoked chicken – 120 g (sliced) · Lettuce – 50 g · Cucumber – 40 g · Tomato – 40 g · Onion – 30 g · Olive oil – 1 tbsp",
    "image": "/images/dishes/smokey-chicken-salad.jpg",
    "price": 13500,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 26,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 320
    },
    "ingredients": [
      "Smoked chicken – 120 g (sliced)",
      "Lettuce – 50 g",
      "Cucumber – 40 g",
      "Tomato – 40 g",
      "Onion – 30 g",
      "Olive oil – 1 tbsp",
      "Lemon juice – 1 tbsp"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 105,
    "slug": "spinach-mushroom-omelette",
    "name": "Spinach Mushroom Omelette",
    "description": "Eggs, Spinach, Mushrooms, and more.",
    "longDescription": "Eggs – 3 · Spinach – 30 g (chopped) · Mushrooms – 40 g (sliced) · Onion – 20 g · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/spinach-mushroom-omelette.jpg",
    "price": 10000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 3",
      "Spinach – 30 g (chopped)",
      "Mushrooms – 40 g (sliced)",
      "Onion – 20 g",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 106,
    "slug": "thums-up-can",
    "name": "Thums Up Can",
    "description": "Thums Up can.",
    "longDescription": "Thums Up can – 1 (chilled)",
    "image": "/images/dishes/thums-up-can.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": false,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Thums Up can – 1 (chilled)"
    ],
    "allergens": [],
    "glycaemicIndex": "high",
    "sugarPerServing": "35g (added)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 107,
    "slug": "tomato-basil-soup",
    "name": "Tomato Basil Soup",
    "description": "Tomato, Onion, Garlic, and more.",
    "longDescription": "Tomato – 150 g (chopped) · Onion – 30 g · Garlic – 5 g · Basil – 6–7 leaves · Olive oil – 1 tsp · Salt – to taste",
    "image": "/images/dishes/tomato-basil-soup.jpg",
    "price": 9500,
    "kitchen": "continental",
    "category": "soups",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 6,
      "carbs": 14,
      "fat": 6,
      "fiber": 3,
      "calories": 140
    },
    "ingredients": [
      "Tomato – 150 g (chopped)",
      "Onion – 30 g",
      "Garlic – 5 g",
      "Basil – 6–7 leaves",
      "Olive oil – 1 tsp",
      "Salt – to taste",
      "Water/veg stock – 200 ml"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 108,
    "slug": "tomato-basil-omelette",
    "name": "Tomato Basil Omelette",
    "description": "Eggs, Tomato, Basil, and more.",
    "longDescription": "Eggs – 2 · Tomato – 40 g (chopped) · Basil – 4 leaves (chopped) · Salt & pepper – to taste · Oil – 1 tsp",
    "image": "/images/dishes/tomato-basil-omelette.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Tomato – 40 g (chopped)",
      "Basil – 4 leaves (chopped)",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 109,
    "slug": "two-boiled-eggs",
    "name": "Two Boiled Eggs",
    "description": "Eggs, Water, Salt.",
    "longDescription": "Eggs – 2 · Water – 300 ml · Salt – ¼ tsp",
    "image": "/images/dishes/two-boiled-eggs.jpg",
    "price": 5500,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Water – 300 ml",
      "Salt – ¼ tsp"
    ],
    "allergens": [
      "Eggs"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 110,
    "slug": "veg-amigos-sandwich",
    "name": "Veg Amigos Sandwich",
    "description": "Multigrain bread, Lettuce, Tomato, and more.",
    "longDescription": "Multigrain bread – 2 slices · Lettuce – 20 g · Tomato – 30 g · Cucumber – 30 g · Onion – 20 g · Mayo/yogurt dip – 1 tbsp",
    "image": "/images/dishes/veg-amigos-sandwich.jpg",
    "price": 14500,
    "kitchen": "indian",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 16,
      "carbs": 45,
      "fat": 14,
      "fiber": 6,
      "calories": 380
    },
    "ingredients": [
      "Multigrain bread – 2 slices",
      "Lettuce – 20 g",
      "Tomato – 30 g",
      "Cucumber – 30 g",
      "Onion – 20 g",
      "Mayo/yogurt dip – 1 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 111,
    "slug": "veg-caesar-story-salad",
    "name": "Veg Caesar Story Salad",
    "description": "Romaine lettuce, Croutons, Parmesan, and more.",
    "longDescription": "Romaine lettuce – 80 g · Croutons – 20 g · Parmesan – 15 g (shaved) · Caesar dressing – 2 tbsp",
    "image": "/images/dishes/veg-caesar-story-salad.jpg",
    "price": 13000,
    "kitchen": "continental",
    "category": "salads",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10 min",
    "macros": {
      "protein": 12,
      "carbs": 12,
      "fat": 14,
      "fiber": 6,
      "calories": 220
    },
    "ingredients": [
      "Romaine lettuce – 80 g",
      "Croutons – 20 g",
      "Parmesan – 15 g (shaved)",
      "Caesar dressing – 2 tbsp"
    ],
    "allergens": [
      "Dairy",
      "Gluten"
    ],
    "glycaemicIndex": "low",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 112,
    "slug": "veg-loaded-bread-omelette-2-egg",
    "name": "Veg Loaded Bread Omelette (2 Egg)",
    "description": "Eggs, Onion, Tomato, and more.",
    "longDescription": "Eggs – 2 · Onion – 20 g · Tomato – 20 g · Capsicum – 20 g · Bread slices – 2 · Salt & pepper – to taste",
    "image": "/images/dishes/veg-loaded-bread-omelette-2-egg.jpg",
    "price": 8000,
    "kitchen": "continental",
    "category": "breakfast",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 20,
      "carbs": 22,
      "fat": 14,
      "fiber": 3,
      "calories": 340
    },
    "ingredients": [
      "Eggs – 2",
      "Onion – 20 g",
      "Tomato – 20 g",
      "Capsicum – 20 g",
      "Bread slices – 2",
      "Salt & pepper – to taste",
      "Oil – 1 tsp"
    ],
    "allergens": [
      "Eggs",
      "Gluten"
    ],
    "glycaemicIndex": "medium",
    "sugarPerServing": "4g",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 113,
    "slug": "zero-calorie-mint-mojito",
    "name": "Zero Calorie Mint Mojito",
    "description": "Soda water, Lemon juice, Mint leaves, and more.",
    "longDescription": "Soda water – 200 ml · Lemon juice – 1 tbsp · Mint leaves – 6–7 · Stevia/sugar-free – 1 sachet · Ice cubes – 4",
    "image": "/images/dishes/zero-calorie-mint-mojito.jpg",
    "price": 7500,
    "kitchen": "continental",
    "category": "beverages",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "5 min",
    "macros": {
      "protein": 3,
      "carbs": 22,
      "fat": 4,
      "fiber": 2,
      "calories": 140
    },
    "ingredients": [
      "Soda water – 200 ml",
      "Lemon juice – 1 tbsp",
      "Mint leaves – 6–7",
      "Stevia/sugar-free – 1 sachet",
      "Ice cubes – 4"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "8g (natural)",
    "customizations": [],
    "isAvailable": true
  },
  {
    "id": 120,
    "slug": "grilled-chicken-sauteed-veg-mash-potato",
    "name": "Grilled Chicken With Sautéed Vegetable And Mash Potato High Protein",
    "description": "Lean grilled chicken breast served with warm sautéed seasonal vegetables and creamy mashed potato. RD-formulated for high protein muscle recovery.",
    "longDescription": "Grilled chicken breast – 150 g · Sautéed broccoli, zucchini, carrots – 80 g · Mashed potato – 80 g · Olive oil – 1 tbsp · Garlic herb seasoning.",
    "image": "/images/dishes/grilled-chicken-sauteed-veg-mash-potato.jpg",
    "price": 33300,
    "kitchen": "continental",
    "category": "mains",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "15-20 min",
    "macros": {
      "protein": 42,
      "carbs": 28,
      "fat": 12,
      "fiber": 6,
      "calories": 388
    },
    "ingredients": [
      "Grilled chicken breast – 150 g",
      "Sautéed broccoli, zucchini, carrots – 80 g",
      "Mashed potato – 80 g",
      "Olive oil – 1 tbsp",
      "Garlic herb seasoning"
    ],
    "allergens": ["Dairy"],
    "glycaemicIndex": "low",
    "sugarPerServing": "2g",
    "customizations": [
      {
        "groupName": "Choose Sauce / Dressing",
        "type": "single",
        "options": [
          { "name": "Cilantro Lime", "priceModifier": 0, "default": true },
          { "name": "Barbeque Sauce", "priceModifier": 0 },
          { "name": "Chipotle Sauce", "priceModifier": 0 }
        ]
      },
      {
        "groupName": "Extra Chicken",
        "type": "single",
        "options": [
          { "name": "No Extra Chicken", "priceModifier": 0, "default": true },
          { "name": "50gm Chicken", "priceModifier": 6000 },
          { "name": "100 Gm Chicken", "priceModifier": 11000 }
        ]
      }
    ],
    "isAvailable": true
  },
  {
    "id": 121,
    "slug": "grilled-veggie-sandwich-ranch-yoghurt",
    "name": "Grilled Veggie Sandwich With Ranch Yoghurt",
    "description": "Crispy grilled seasonal vegetables sandwiched with high-fiber bread and a light ranch yogurt dressing.",
    "longDescription": "High-fiber bread slices – 2 · Grilled bell peppers, zucchini, onions – 60 g · Lettuce – 20 g · Ranch yogurt dressing – 2 tbsp.",
    "image": "/images/dishes/grilled-veggie-sandwich-ranch-yoghurt.jpg",
    "price": 26000,
    "kitchen": "continental",
    "category": "wraps",
    "isVeg": true,
    "rdVerified": true,
    "prepTime": "10-12 min",
    "macros": {
      "protein": 11,
      "carbs": 38,
      "fat": 8,
      "fiber": 7,
      "calories": 268
    },
    "ingredients": [
      "High-fiber bread slices – 2",
      "Grilled bell peppers, zucchini, onions – 60 g",
      "Lettuce – 20 g",
      "Ranch yogurt dressing – 2 tbsp"
    ],
    "allergens": ["Dairy", "Gluten"],
    "glycaemicIndex": "low",
    "sugarPerServing": "3g",
    "customizations": [
      {
        "groupName": "Choose Bread Type",
        "type": "single",
        "options": [
          { "name": "Brown Bread", "priceModifier": 0, "default": true },
          { "name": "Multigrain Bread", "priceModifier": 1500 }
        ]
      },
      {
        "groupName": "Add-ons",
        "type": "multiple",
        "options": [
          { "name": "Hummus (70gm)", "priceModifier": 3000 },
          { "name": "Hydrating Watermelon Juice", "priceModifier": 8000 },
          { "name": "Zero Calorie Mint Mojito", "priceModifier": 7000 }
        ]
      }
    ],
    "isAvailable": true
  },
  {
    "id": 122,
    "slug": "grilled-chicken-breast-single-serve",
    "name": "Grilled Chicken Breast [Single Serve]",
    "description": "Juicy grilled chicken breast seasoned with herbs. High protein, zero carbs, perfect for keto and recovery.",
    "longDescription": "Grilled chicken breast – 120 g · Olive oil – 1 tsp · Herb seasoning.",
    "image": "/images/dishes/grilled-chicken-breast-single-serve.jpg",
    "price": 36000,
    "kitchen": "continental",
    "category": "mains",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "12-15 min",
    "macros": {
      "protein": 31,
      "carbs": 0,
      "fat": 6,
      "fiber": 0,
      "calories": 180
    },
    "ingredients": [
      "Grilled chicken breast – 120 g",
      "Olive oil – 1 tsp",
      "Herb seasoning"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "0g",
    "customizations": [
      {
        "groupName": "Choose Sauce / Dressing",
        "type": "single",
        "options": [
          { "name": "Cilantro Lime", "priceModifier": 0, "default": true },
          { "name": "Chipotle Sauce", "priceModifier": 0 },
          { "name": "Barbeque Sauce", "priceModifier": 0 }
        ]
      },
      {
        "groupName": "Add-ons",
        "type": "multiple",
        "options": [
          { "name": "brown Rice", "priceModifier": 2500 },
          { "name": "Sauteed Veggies", "priceModifier": 4000 }
        ]
      }
    ],
    "isAvailable": true
  },
  {
    "id": 123,
    "slug": "boiled-chicken-breast-single-serve",
    "name": "Boiled Chicken Breast [Single Serve]",
    "description": "Tender boiled chicken breast served shredded or sliced. Pure lean protein for clinical protocols.",
    "longDescription": "Chicken breast – 120 g (boiled) · Light salt.",
    "image": "/images/dishes/boiled-chicken-breast-single-serve.jpg",
    "price": 27800,
    "kitchen": "continental",
    "category": "mains",
    "isVeg": false,
    "rdVerified": true,
    "prepTime": "10-12 min",
    "macros": {
      "protein": 30,
      "carbs": 0,
      "fat": 3,
      "fiber": 0,
      "calories": 150
    },
    "ingredients": [
      "Chicken breast – 120 g (boiled)",
      "Light salt"
    ],
    "allergens": [],
    "glycaemicIndex": "low",
    "sugarPerServing": "0g",
    "customizations": [
      {
        "groupName": "Choose Portion size",
        "type": "single",
        "options": [
          { "name": "100 Gm Chicken", "priceModifier": 0, "default": true },
          { "name": "50gm Chicken", "priceModifier": -10000 }
        ]
      },
      {
        "groupName": "Add-ons",
        "type": "multiple",
        "options": [
          { "name": "Hummus (70gm)", "priceModifier": 3000 },
          { "name": "1 Pc Pita", "priceModifier": 1500 },
          { "name": "Hummus (140gm)", "priceModifier": 5500 }
        ]
      }
    ],
    "isAvailable": true
  }
];

import { ESTIMATED_MACROS } from "./estimatedMacros";
import { deriveAllergensFromIngredients } from "./allergenDerive";

/**
 * Overlay allergen provenance onto a dish from its `ingredients`.
 *  - No curated list + an opaque ingredient the deriver can't classify → we
 *    cannot assert the dish is allergen-safe, so fail it closed
 *    (`allergensReviewed: false`; the strict checkout gate refuses it).
 *  - Otherwise merge any DETECTED allergens (only ever additive/protective).
 *    When the dish had no curated list, or derivation surfaced an allergen the
 *    curated list missed, flag `allergensDerived` (UI: "auto-detected from
 *    ingredients"). A complete, non-empty curated list passes through untouched
 *    (kitchen review is trusted).
 */
function _deriveAllergens(d: DishData): DishData {
  const { detected, ambiguous } = deriveAllergensFromIngredients(d.ingredients);
  const curated = d.allergens ?? [];
  const merged = Array.from(new Set<string>([...curated, ...detected]));
  if (curated.length === 0 && ambiguous.length > 0) {
    return { ...d, allergens: merged, allergensReviewed: false };
  }
  if (curated.length === 0 || merged.length > curated.length) {
    return { ...d, allergens: merged, allergensDerived: true };
  }
  return d;
}

function _macroKey(m: DishMacros): string {
  return `${m.protein}|${m.carbs}|${m.fat}|${m.fiber}|${m.calories}`;
}

// Placeholder detection runs on the RAW seed macros (before overlay) so a dish
// that becomes the last remaining member of a placeholder bucket (once its
// bucket-mates get estimates) is still correctly flagged.
const _rawBucketCounts: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const d of RAW_DISHES) {
    const k = _macroKey(d.macros);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
})();

/**
 * Public catalog. A dish whose seed macros were a duplicated placeholder bucket
 * AND for which the ingredient calculator produced a HIGH-confidence estimate
 * gets that estimate overlaid and is flagged `macrosEstimated` (the UI labels it
 * "estimated from ingredients"). A placeholder dish with no estimate (e.g. an
 * ingredient-less beverage) stays `macrosProvisional` so the UI still gates it.
 * Curated distinct macros pass through unflagged (shown as-is).
 */
export const DISHES: DishData[] = RAW_DISHES.map((d) => {
  const est = ESTIMATED_MACROS[d.slug];
  const withMacros = est
    ? { ...d, macros: est, macrosEstimated: true, macrosProvisional: false }
    : {
        ...d,
        macrosEstimated: false,
        macrosProvisional: (_rawBucketCounts.get(_macroKey(d.macros)) ?? 0) > 1,
      };
  return _deriveAllergens(withMacros);
});

  // ── Phase B1 — à la carte hero set ─────────────────────────────────────────
  // À la carte is NOT the full 117-dish catalog. It is the proven, high-margin,
  // batch-friendly KEEP-PUSH heroes from the menu-engineering curation
  // (scripts/data/curated_catalog.csv) — grilled proteins, wraps, rice bowls,
  // high-protein omelettes. Only these are offered for scheduled à la carte
  // ordering; everything else stays subscription/plan-only. Default: not
  // enabled. 26 of the 34 KEEP-PUSH rows resolve to a catalog dish by exact
  // name; the other 8 are renamed variants or live on the separate Petpooja
  // menu — reconciled separately, never fuzzy-matched (per the E1.1 lesson).
  export const AL_A_CARTE_HERO_SLUGS: ReadonlySet<string> = new Set([
    "avocado-toast",
    "barbeque-chicken-burrito-wrap",
    "barbeque-grilled-chicken-rice-bowl",
    "boiled-chicken-breast-single-serve",
    "broccoli-lemon-chicken-salad",
    "chicken-pita-pockets-with-hummus",
    "chicken-tikka-sandwich-with-ranch-yoghurt",
    "chilli-chipotle-paneer-burrito-wrap",
    "chilli-chipotle-paneer-rice-bowl",
    "chipotle-chicken-burrito-wrap",
    "chipotle-grilled-chicken-rice-bowl",
    "classic-bread-omelette-2-egg",
    "crispy-mushroom-burrito-wrap",
    "grilled-chicken-breast-single-serve",
    "grilled-chicken-sauteed-veg-mash-potato",
    "grilled-veggie-sandwich-ranch-yoghurt",
    "healthy-whole-wheat-chicken-tikka-wrap",
    "healthy-whole-wheat-paneer-wrap",
    "high-protein-chicken-omelette",
    "hummus-pita-classic",
    "moong-dal-chilla-with-curd",
    "paneer-tikka-burrito-wrap",
    "quinoa-khichdi",
    "smoked-chicken-cheese-omelette",
    "spinach-mushroom-omelette",
    "veg-loaded-bread-omelette-2-egg",
  ]);

  /** True when a dish is offered for scheduled à la carte ordering (a hero). */
  export function isAlaCarteEnabled(dish: Pick<DishData, "slug">): boolean {
    return AL_A_CARTE_HERO_SLUGS.has(dish.slug);
  }

  export function getDishBySlug(slug: string): DishData | undefined {
    return DISHES.find((d) => d.slug === slug);
  }

  export function getDishById(id: number): DishData | undefined {
    return DISHES.find((d) => d.id === id);
  }

  export function getDishAllergens(slug: string): string[] | null {
    const d = getDishBySlug(slug);
    return d ? d.allergens : null;
  }

  /**
   * Whether a dish's `allergens` list is a REVIEWED disclosure. Absence
   * defaults to reviewed — the legacy curated catalog is hand-reviewed, so an
   * unset flag must not retroactively block it. Only an explicit
   * `allergensReviewed === false` marks the list as unchecked/unknown.
   */
  export function allergensAreReviewed(
    dish: Pick<DishData, "allergensReviewed">,
  ): boolean {
    return dish.allergensReviewed !== false;
  }

  /**
   * Discriminated view of a dish's allergen disclosure — the single source of
   * truth for both the PDP copy and the safety gate. It exists to stop an empty
   * array from ever meaning two different things:
   *  - `reviewed` + non-empty list → the dish contains those allergens.
   *  - `reviewed` + empty list      → affirmatively "no declared allergens".
   *  - `unchecked`                  → allergen data is UNKNOWN; callers must
   *    never render "no allergens" and the strict gate refuses the dish.
   */
  export type AllergenDisclosure =
    | { state: "reviewed"; allergens: string[] }
    | { state: "derived"; allergens: string[] }
    | { state: "unchecked" };

  export function getAllergenDisclosure(
    dish: Pick<DishData, "allergens" | "allergensReviewed" | "allergensDerived">,
  ): AllergenDisclosure {
    if (dish.allergensReviewed === false) return { state: "unchecked" };
    if (dish.allergensDerived) {
      return { state: "derived", allergens: dish.allergens ?? [] };
    }
    return { state: "reviewed", allergens: dish.allergens ?? [] };
  }

  // ---------------------------------------------------------------------------
  // Macro data-integrity guard.
  //
  // A large share of the seeded catalog carried copy-pasted placeholder macro
  // "buckets" (e.g. every beverage shared 3P/22C/4F/140kcal). Most are now
  // resolved by ingredient-derived estimates (see the DISHES overlay above,
  // flagged `macrosEstimated`). The remainder — placeholders with no reliable
  // estimate — are flagged `macrosProvisional` at build time so the UI can show
  // an honest "macros being verified" state instead of a duplicated fake. This
  // never fabricates confident numbers.
  // ---------------------------------------------------------------------------
  /**
   * True when this dish's macros are still an unresolved placeholder (no
   * per-dish value and no reliable estimate). Reads the build-time flag set by
   * the DISHES overlay. Estimated dishes return false (they carry a real, if
   * estimated, value — the UI labels them separately via `macrosEstimated`).
   */
  export function macrosAreProvisional(dish: Pick<DishData, "macrosProvisional">): boolean {
    return dish.macrosProvisional === true;
  }

// ── Nutrition calculator ──────────────────────────────────────────────────────
// Ingredient → macro engine + per-100g reference table. Powers both the one-off
// backfill of the seed catalog and live ingest of new Petpooja/CMS items.
// The calculator's own macro shape is re-exported as `ComputedMacros` to avoid
// colliding with the catalog `DishMacros` interface above (different field names:
// kcal/proteinG/… vs protein/calories/…).
export {
  parseQuantity,
  toGrams,
  normalizeName,
  parseIngredientLine,
  parseLongDescription,
  lookup,
  computeDishMacros,
} from "./nutritionCalc";
export type {
  NutritionPer100g,
  NutritionTable,
  ParsedIngredient,
  DishMacrosResult,
  DishMacros as ComputedMacros,
} from "./nutritionCalc";
export { NUTRITION_TABLE } from "./nutritionTable";

import {
  computeDishMacros as _computeDishMacros,
  computeDishMacrosFromIngredients as _computeDishMacrosFromIngredients,
} from "./nutritionCalc";
import type { DishMacrosResult as _DishMacrosResult } from "./nutritionCalc";
import { NUTRITION_TABLE as _NUTRITION_TABLE } from "./nutritionTable";

/**
 * Compute a dish's macros from its ingredient longDescription using the bundled
 * per-100g reference table. Returns the computed macros plus a coverage /
 * confidence report — callers should only surface a result as verified when
 * confidence is "high" (see DishMacrosResult).
 */
export function computeCatalogMacros(longDescription: string): _DishMacrosResult {
  return _computeDishMacros(longDescription, _NUTRITION_TABLE);
}

/**
 * Compute a dish's macros from its full `ingredients` list — the preferred entry
 * point, since the abbreviated longDescription drops ingredients and undercounts.
 * Used by the macro backfill (scripts/backfill-macros.ts) to regenerate
 * ESTIMATED_MACROS from the RD-verified recipe list.
 */
export function computeCatalogMacrosFromIngredients(
  ingredients: readonly string[],
): _DishMacrosResult {
  return _computeDishMacrosFromIngredients(ingredients, _NUTRITION_TABLE);
}

// Re-exported so the macro backfill can read the current estimate set and
// regenerate it in place (scripts/backfill-macros.ts --emit-estimated).
export { ESTIMATED_MACROS } from "./estimatedMacros";

// ── Dish-data integrity gate ──────────────────────────────────────────────────
// Publish-time validation that catches contradictory allergen / diet / serving
// data before it reaches the clinical surface. See ./dishIntegrity.ts.
export {
  findDishIntegrityViolations,
  findCatalogIntegrityViolations,
} from "./dishIntegrity";
export type { DishIntegrityViolation } from "./dishIntegrity";
