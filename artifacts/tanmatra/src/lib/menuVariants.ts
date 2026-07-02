import type { DishData, DishCategory, DishKitchen, DishMacros } from "./menuData";

export interface DishVariantOption {
  name: string; // e.g. "Veg", "Chicken", "White Bread"
  dishId: number; // Flat dish ID
}

export interface DishVariantGroup {
  name: string; // e.g. "Choose Protein", "Choose Bread"
  options: DishVariantOption[];
}

export interface ConsolidatedVariant {
  id: number; // Flat dish ID
  slug: string; // Flat dish slug
  nameSuffix: string; // e.g. "Veg", "Chicken"
  price: number;
  macros: DishMacros;
  glycaemicIndex: "low" | "medium" | "high";
  isVeg: boolean;
  isAvailable: boolean;
  rdVerified: boolean;
  optionNames: string[]; // e.g. ["Veg"]
}

export interface ConsolidatedDish {
  id: number; // Default variant ID
  slug: string; // Base slug (e.g. "alfredo-pasta")
  name: string; // Parent name (e.g. "Alfredo Pasta")
  description: string;
  longDescription: string;
  image: string;
  category: DishCategory;
  kitchen: DishKitchen;
  isVeg: boolean;
  rdVerified: boolean;
  prepTime: string;
  glycaemicIndex: "low" | "medium" | "high";
  sugarPerServing: string;
  pairingSlug?: string;
  isAvailable: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  optionGroups: DishVariantGroup[];
  variants: ConsolidatedVariant[];
}

/**
 * Group flat dishes list by base name and return consolidated parent dishes with variants.
 */
export function groupCatalogDishes(dishes: DishData[]): ConsolidatedDish[] {
  const groups = new Map<string, DishData[]>();

  dishes.forEach((dish) => {
    // Suffix regex pattern: " - Veg", " - Chicken", " (Veg)", etc.
    const match = dish.name.match(/(.+?)(?:\s*-\s*|\s+\()([A-Za-z\s]+)\)?$/);
    const parentName = match ? match[1].trim() : dish.name;
    
    if (!groups.has(parentName)) {
      groups.set(parentName, []);
    }
    groups.get(parentName)!.push(dish);
  });

  const consolidatedList: ConsolidatedDish[] = [];

  groups.forEach((variantDishes, parentName) => {
    if (variantDishes.length === 1) {
      // Simple dish with no variants
      const d = variantDishes[0];
      consolidatedList.push({
        id: d.id,
        slug: d.slug,
        name: d.name,
        description: d.description,
        longDescription: d.longDescription,
        image: d.image,
        category: d.category,
        kitchen: d.kitchen,
        isVeg: d.isVeg,
        rdVerified: d.rdVerified,
        prepTime: d.prepTime,
        glycaemicIndex: d.glycaemicIndex,
        sugarPerServing: d.sugarPerServing,
        pairingSlug: d.pairingSlug,
        isAvailable: d.isAvailable,
        averageRating: d.averageRating,
        reviewCount: d.reviewCount,
        optionGroups: [],
        variants: [
          {
            id: d.id,
            slug: d.slug,
            nameSuffix: "Standard",
            price: d.price,
            macros: d.macros,
            glycaemicIndex: d.glycaemicIndex,
            isVeg: d.isVeg,
            isAvailable: d.isAvailable,
            rdVerified: d.rdVerified,
            optionNames: [],
          },
        ],
      });
    } else {
      // Sort variants by price (ascending) so the default is cheapest
      const sortedDishes = [...variantDishes].sort((a, b) => a.price - b.price);
      const defaultDish = sortedDishes[0];

      // Build options list
      const options: DishVariantOption[] = [];
      const variants: ConsolidatedVariant[] = [];

      sortedDishes.forEach((d) => {
        const match = d.name.match(/(.+?)(?:\s*-\s*|\s+\()([A-Za-z\s]+)\)?$/);
        const suffix = match ? match[2].trim() : "Standard";

        options.push({
          name: suffix,
          dishId: d.id,
        });

        variants.push({
          id: d.id,
          slug: d.slug,
          nameSuffix: suffix,
          price: d.price,
          macros: d.macros,
          glycaemicIndex: d.glycaemicIndex,
          isVeg: d.isVeg,
          isAvailable: d.isAvailable,
          rdVerified: d.rdVerified,
          optionNames: [suffix],
        });
      });

      // Determine option group name based on suffix names
      const sampleSuffix = options[0].name.toLowerCase();
      const groupName = sampleSuffix.includes("bread")
        ? "Choose Bread"
        : sampleSuffix.includes("grain")
        ? "Choose Grain"
        : "Choose Protein";

      // Build base parent slug by removing suffix from default dish slug
      // e.g. "alfredo-pasta-veg" -> "alfredo-pasta"
      let baseSlug = defaultDish.slug;
      const suffixSlug = sampleSuffix.replace(/\s+/g, "-");
      if (baseSlug.endsWith("-" + suffixSlug)) {
        baseSlug = baseSlug.slice(0, -(suffixSlug.length + 1));
      } else if (baseSlug.endsWith("-veg")) {
        baseSlug = baseSlug.slice(0, -4);
      }

      consolidatedList.push({
        id: defaultDish.id,
        slug: baseSlug,
        name: parentName,
        description: defaultDish.description,
        longDescription: defaultDish.longDescription,
        image: defaultDish.image,
        category: defaultDish.category,
        kitchen: defaultDish.kitchen,
        isVeg: sortedDishes.some((d) => d.isVeg), // If any variant is veg (e.g. Veg pasta)
        rdVerified: defaultDish.rdVerified,
        prepTime: defaultDish.prepTime,
        glycaemicIndex: defaultDish.glycaemicIndex,
        sugarPerServing: defaultDish.sugarPerServing,
        pairingSlug: defaultDish.pairingSlug,
        isAvailable: sortedDishes.some((d) => d.isAvailable), // Available if any variant is available
        averageRating: defaultDish.averageRating,
        reviewCount: defaultDish.reviewCount,
        optionGroups: [
          {
            name: groupName,
            options,
          },
        ],
        variants,
      });
    }
  });

  return consolidatedList;
}
