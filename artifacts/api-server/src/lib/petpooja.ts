import { type InsertMenuItem } from "@workspace/db/schema";

export interface PetpoojaItem {
  itemid: string;
  itemname: string;
  itemdescription?: string;
  price: string;
  active: string;
  in_stock: string;
  item_categoryid: string;
  item_attributeid: string;
  item_image_url?: string;
  cuisine?: string[];
  variation?: Array<{
    id: string;
    variationid: string;
    name: string;
    groupname: string;
    price: string;
    active: string;
  }>;
  variation_groupname?: string;
  addon?: Array<{
    addon_group_id: string;
    addon_item_selection_min: string;
    addon_item_selection_max: string;
  }>;
  nutrition?: {
    calories?: { amount: number; unit: string };
    protien?: { amount: number; unit: string };
    carbohydrate?: { amount: number; unit: string };
    totalFat?: { amount: number; unit: string };
    fiber?: { amount: number; unit: string };
    allergens?: Array<{ allergen: string; allergenDesc: string }>;
  };
}

export interface PetpoojaCategory {
  categoryid: string;
  categoryname: string;
  active: string;
}

export interface PetpoojaAddonGroup {
  addongroupid: string;
  addongroup_name: string;
  active: string;
  addongroupitems: Array<{
    addonitemid: string;
    addonitem_name: string;
    addonitem_price: string;
    active: string;
  }>;
}

export interface PetpoojaAttribute {
  attributeid: string;
  attribute: string;
  active: string;
}

export interface PetpoojaPushMenuPayload {
  success: string;
  restaurants: Array<{
    restaurantid: string;
    details: {
      restaurantname: string;
    };
  }>;
  categories: PetpoojaCategory[];
  items: PetpoojaItem[];
  addongroups: PetpoojaAddonGroup[];
  attributes: PetpoojaAttribute[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function mapPetpoojaItem(
  item: PetpoojaItem,
  categories: PetpoojaCategory[],
  addonGroups: PetpoojaAddonGroup[],
  attributes: PetpoojaAttribute[]
): Omit<InsertMenuItem, "contraindications"> & { contraindications?: string[] } {
  const slug = slugify(item.itemname);

  // 1. Resolve Category Name
  const cat = categories.find((c) => c.categoryid === item.item_categoryid);
  const category = cat ? cat.categoryname : "uncategorized";

  // 2. Resolve Veg Status
  const attr = attributes.find((a) => a.attributeid === item.item_attributeid);
  const isVeg = attr ? attr.attribute === "veg" : true;

  // 3. Resolve Availability
  const isAvailable =
    item.active === "1" &&
    (item.in_stock === "1" || item.in_stock === "2" || item.in_stock === "true");

  // 4. Base Price in Paise
  const pricePaise = Math.round(parseFloat(item.price || "0") * 100);

  // 5. Parse Macros & Allergens
  const allergens =
    item.nutrition?.allergens?.map((a) => a.allergen) ?? [];

  const macros = item.nutrition
    ? {
        kcal: Number(item.nutrition.calories?.amount ?? 0),
        proteinG: Number(item.nutrition.protien?.amount ?? 0),
        carbsG: Number(item.nutrition.carbohydrate?.amount ?? 0),
        fatG: Number(item.nutrition.totalFat?.amount ?? 0),
        fiberG: Number(item.nutrition.fiber?.amount ?? 0),
      }
    : null;

  // 6. Map Customizations (Addons & Variations)
  const customizations: Array<{
    groupName: string;
    type: "single" | "multiple";
    options: Array<{
      name: string;
      priceModifier: number;
      default?: boolean;
    }>;
  }> = [];

  // 6a. Map Variations
  if (item.variation && item.variation.length > 0) {
    const varGroupName =
      item.variation_groupname ||
      item.variation[0].groupname ||
      "Size";
    
    const options = item.variation
      .filter((v) => v.active === "1")
      .map((v, i) => {
        const vPrice = parseFloat(v.price || "0");
        const basePriceVal = parseFloat(item.price || "0");
        const priceModifier = Math.round((vPrice - basePriceVal) * 100);
        return {
          name: v.name,
          priceModifier,
          default: i === 0 || priceModifier === 0,
        };
      });

    if (options.length > 0) {
      customizations.push({
        groupName: varGroupName,
        type: "single",
        options,
      });
    }
  }

  // 6b. Map Addons
  if (item.addon && item.addon.length > 0) {
    for (const addonRef of item.addon) {
      const group = addonGroups.find(
        (g) => g.addongroupid === addonRef.addon_group_id
      );
      if (group && group.active === "1") {
        const options = group.addongroupitems
          .filter((ai) => ai.active === "1")
          .map((ai) => ({
            name: ai.addonitem_name,
            priceModifier: Math.round(parseFloat(ai.addonitem_price || "0") * 100),
          }));

        if (options.length > 0) {
          const maxSelection = parseInt(addonRef.addon_item_selection_max || "1");
          customizations.push({
            groupName: group.addongroup_name,
            type: maxSelection > 1 ? "multiple" : "single",
            options,
          });
        }
      }
    }
  }

  return {
    slug,
    name: item.itemname,
    description: item.itemdescription || "",
    pricePaise,
    category,
    kitchenLocation: "default",
    isVeg,
    isAvailable,
    imageUrl: item.item_image_url || null,
    tags: [`petpooja:${item.itemid}`],
    allergens,
    cuisineTags: item.cuisine || [],
    macros,
    macrosAreEstimate: true,
    rdVerified: false,
    allergenReviewState: "reviewed", // Webhook menu updates default to reviewed to be visible
    customizations: customizations.length > 0 ? customizations : null,
  };
}
