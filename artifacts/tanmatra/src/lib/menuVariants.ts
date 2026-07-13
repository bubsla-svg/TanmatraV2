import type { DishData, DishCategory, DishKitchen, DishMacros } from "./menuData";
import { VARIANT_FAMILIES } from "./dishEnrichment";

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
  macrosProvisional?: boolean;
  macrosEstimated?: boolean;
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

  // Helper to get parent identifier/name for a dish
  const getParentKey = (dish: DishData): { key: string; name: string } => {
    const familySlugs = VARIANT_FAMILIES[dish.slug];
    if (familySlugs && familySlugs.length > 0) {
      // Find the primary/default dish of this family (the first one)
      const primarySlug = familySlugs[0];
      const primaryDish = dishes.find(d => d.slug === primarySlug) || dish;
      
      // Derive a clean parent name by removing common suffixes
      let cleanName = primaryDish.name;
      cleanName = cleanName
        .replace(/\s*-\s*(Veg|Chicken|Prawns|Paneer|Tofu|Classic|Standard|White Bread|Brown Bread)/gi, "")
        .replace(/\s*\((Veg|Chicken|Prawns|Paneer|Tofu|Classic|Standard|White Bread|Brown Bread)\)/gi, "")
        .replace(/(Paneer|Fiesta|Grilled Chicken|Chicken|Tofu|with Falafel|with Sunny Side Up|with Poached Boiled Egg|White Bread|Brown Bread)\s*/gi, "")
        .trim();
        
      // Special case cleanups to make titles perfect
      if (primarySlug.includes("chipotle") && primarySlug.includes("wrap")) cleanName = "Chipotle Burrito Wrap";
      if (primarySlug.includes("chipotle") && primarySlug.includes("bowl")) cleanName = "Chipotle Rice Bowl";
      if (primarySlug.includes("barbeque") && primarySlug.includes("bowl")) cleanName = "Barbeque Rice Bowl";
      if (primarySlug.includes("crispy-mushroom") && primarySlug.includes("bowl")) cleanName = "Crispy Mushroom Rice Bowl";
      if (primarySlug.includes("chicken-breast")) cleanName = "Chicken Breast";
      if (primarySlug.includes("avocado-toast")) cleanName = "Avocado Toast";
      if (primarySlug.includes("hummus-pita")) cleanName = "Hummus Pita";
      if (primarySlug.includes("greek-roman")) cleanName = "Greek Roman Salad";
      if (primarySlug.includes("whole-wheat") && primarySlug.includes("wrap")) cleanName = "Whole Wheat Wrap";
      if (primarySlug.includes("nutella")) cleanName = "Nutella Toast";
      
      return { key: "family:" + primarySlug, name: cleanName };
    }

    // Default suffix regex fallback for other/future variants
    const match = dish.name.match(/(.+?)(?:\s*-\s*|\s+\()([A-Za-z\s]+)\)?$/);
    const parentName = match ? match[1].trim() : dish.name;
    return { key: "name:" + parentName.toLowerCase(), name: parentName };
  };

  dishes.forEach((dish) => {
    const { key } = getParentKey(dish);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(dish);
  });

  const consolidatedList: ConsolidatedDish[] = [];

  groups.forEach((variantDishes, key) => {
    const { name: parentName } = getParentKey(variantDishes[0]);

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
            macrosProvisional: d.macrosProvisional,
            macrosEstimated: d.macrosEstimated,
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
        const familySlugs = VARIANT_FAMILIES[d.slug];
        let suffix = "Standard";
        if (familySlugs) {
          if (d.slug.includes("chicken") || d.name.toLowerCase().includes("chicken")) {
            suffix = "Chicken";
          } else if (d.slug.includes("prawn") || d.name.toLowerCase().includes("prawn")) {
            suffix = "Prawns";
          } else if (d.slug.includes("paneer") || d.name.toLowerCase().includes("paneer")) {
            suffix = "Paneer";
          } else if (d.slug.includes("tofu") || d.name.toLowerCase().includes("tofu")) {
            suffix = "Tofu";
          } else if (d.slug.includes("falafel") || d.name.toLowerCase().includes("falafel")) {
            suffix = "Falafel";
          } else if (d.slug.includes("white") || d.name.toLowerCase().includes("white")) {
            suffix = "White Bread";
          } else if (d.slug.includes("brown") || d.name.toLowerCase().includes("brown")) {
            suffix = "Brown Bread";
          } else if (d.slug.includes("sunny") || d.name.toLowerCase().includes("sunny")) {
            suffix = "Sunny-Side Egg";
          } else if (d.slug.includes("poached") || d.name.toLowerCase().includes("poached")) {
            suffix = "Poached Egg";
          } else if (d.slug.includes("egg") || d.name.toLowerCase().includes("egg")) {
            suffix = "With Egg";
          } else if (d.slug.includes("boiled") && d.name.toLowerCase().includes("boiled")) {
            suffix = "Boiled";
          } else if (d.slug.includes("grilled") && d.name.toLowerCase().includes("grilled")) {
            suffix = "Grilled";
          } else if (d.slug.includes("veg") || d.name.toLowerCase().includes("veg")) {
            suffix = "Veg";
          } else {
            suffix = "Classic";
          }
        } else {
          const match = d.name.match(/(.+?)(?:\s*-\s*|\s+\()([A-Za-z\s]+)\)?$/);
          suffix = match ? match[2].trim() : "Standard";
        }

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
          macrosProvisional: d.macrosProvisional,
          macrosEstimated: d.macrosEstimated,
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
        isVeg: sortedDishes.some((d) => d.isVeg),
        rdVerified: defaultDish.rdVerified,
        prepTime: defaultDish.prepTime,
        glycaemicIndex: defaultDish.glycaemicIndex,
        sugarPerServing: defaultDish.sugarPerServing,
        pairingSlug: defaultDish.pairingSlug,
        isAvailable: sortedDishes.some((d) => d.isAvailable),
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
