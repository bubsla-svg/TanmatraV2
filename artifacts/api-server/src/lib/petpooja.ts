import { type InsertMenuItem, type MenuItem } from "@workspace/db/schema";

export interface PetpoojaItem {
  itemid: string;
  itemallowvariation: string;
  itemrank: string;
  item_categoryid: string;
  item_ordertype: string;
  item_tags?: string[];
  item_packingcharges?: string;
  itemallowaddon: string;
  itemaddonbasedon: string;
  item_favorite: string;
  ignore_taxes: string;
  ignore_discounts: string;
  in_stock: string;
  itemname: string;
  item_attributeid: string;
  itemdescription: string;
  minimumpreparationtime?: string;
  price: string;
  active: string;
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
    allergenReviewState: "reviewed",
    customizations: customizations.length > 0 ? customizations : null,
  };
}

export function extractPetpoojaId(tags: string[] | null): string | null {
  if (!tags) return null;
  const tag = tags.find((t) => t.startsWith("petpooja:"));
  return tag ? tag.split(":")[1] : null;
}

export function serializeMenuToPetpooja(dbItems: MenuItem[]): PetpoojaPushMenuPayload {
  const categoriesMap = new Map<string, string>(); // name -> id
  const addonGroupsMap = new Map<string, PetpoojaAddonGroup>(); // name -> group
  const variationsList: Array<{ variationid: string; name: string; groupname: string; status: string }> = [];

  let nextCategoryId = 500000;
  let nextAddonGroupId = 130000;
  let nextAddonItemId = 1100000;
  let nextVariationId = 80000;

  const items: PetpoojaItem[] = dbItems.map((dbItem) => {
    const itemid = extractPetpoojaId(dbItem.tags) || dbItem.id.toString();

    // Resolve category id
    let categoryid = categoriesMap.get(dbItem.category);
    if (!categoryid) {
      categoryid = (nextCategoryId++).toString();
      categoriesMap.set(dbItem.category, categoryid);
    }

    // Resolve attribute status
    const item_attributeid = dbItem.isVeg ? "1" : "2";

    // Parse customizations
    const itemAddons: Array<{ addon_group_id: string; addon_item_selection_min: string; addon_item_selection_max: string }> = [];
    const itemVariations: Array<{
      id: string;
      variationid: string;
      name: string;
      groupname: string;
      price: string;
      active: string;
    }> = [];

    const basePrice = dbItem.pricePaise / 100;

    if (dbItem.customizations && Array.isArray(dbItem.customizations)) {
      for (const cust of dbItem.customizations) {
        if (cust.groupName.toLowerCase() === "quantity" || cust.groupName.toLowerCase() === "size") {
          for (const opt of cust.options) {
            const variationid = (nextVariationId++).toString();
            variationsList.push({
              variationid,
              name: opt.name,
              groupname: cust.groupName,
              status: "1",
            });

            const optPrice = basePrice + (opt.priceModifier / 100);
            itemVariations.push({
              id: (nextVariationId * 2).toString(),
              variationid,
              name: opt.name,
              groupname: cust.groupName,
              price: optPrice.toString(),
              active: "1",
            });
          }
        } else {
          // Addon group
          let addonGroup = addonGroupsMap.get(cust.groupName);
          if (!addonGroup) {
            const addongroupid = (nextAddonGroupId++).toString();
            addonGroup = {
              addongroupid,
              addongroup_name: cust.groupName,
              active: "1",
              addongroupitems: cust.options.map((opt) => ({
                addonitemid: (nextAddonItemId++).toString(),
                addonitem_name: opt.name,
                addonitem_price: (opt.priceModifier / 100).toString(),
                active: "1",
              })),
            };
            addonGroupsMap.set(cust.groupName, addonGroup);
          }

          itemAddons.push({
            addon_group_id: addonGroup.addongroupid,
            addon_item_selection_min: "0",
            addon_item_selection_max: cust.type === "multiple" ? "4" : "1",
          });
        }
      }
    }

    // Map nutrition
    const nutrition: any = {};
    if (dbItem.macros) {
      nutrition.calories = { amount: dbItem.macros.kcal, unit: "kcal" };
      nutrition.protien = { amount: dbItem.macros.proteinG, unit: "g" };
      nutrition.carbohydrate = { amount: dbItem.macros.carbsG, unit: "g" };
      nutrition.totalFat = { amount: dbItem.macros.fatG, unit: "g" };
      if (dbItem.macros.fiberG) {
        nutrition.fiber = { amount: dbItem.macros.fiberG, unit: "g" };
      }
      if (dbItem.allergens && dbItem.allergens.length > 0) {
        nutrition.allergens = dbItem.allergens.map((a) => ({
          allergen: a,
          allergenDesc: a,
        }));
      }
    }

    return {
      itemid,
      itemallowvariation: itemVariations.length > 0 ? "1" : "0",
      itemrank: "50",
      item_categoryid: categoryid,
      item_ordertype: "1,2,3",
      item_tags: dbItem.tags || [],
      item_packingcharges: "",
      itemallowaddon: itemAddons.length > 0 ? "1" : "0",
      itemaddonbasedon: "0",
      item_favorite: "0",
      ignore_taxes: "0",
      ignore_discounts: "0",
      in_stock: dbItem.isAvailable ? "2" : "0",
      variation_groupname: itemVariations.length > 0 ? itemVariations[0].groupname : "",
      variation: itemVariations,
      addon: itemAddons,
      itemname: dbItem.name,
      item_attributeid,
      itemdescription: dbItem.description,
      minimumpreparationtime: dbItem.prepTime || "",
      price: basePrice.toString(),
      active: dbItem.isAvailable ? "1" : "0",
      item_image_url: dbItem.imageUrl || "",
      nutrition: Object.keys(nutrition).length > 0 ? nutrition : undefined,
    } as any;
  });

  const categories: PetpoojaCategory[] = Array.from(categoriesMap.entries()).map(([name, id]) => ({
    categoryid: id,
    categoryname: name,
    active: "1",
  }));

  const addonGroups: PetpoojaAddonGroup[] = Array.from(addonGroupsMap.values());

  const attributes: PetpoojaAttribute[] = [
    { attributeid: "1", attribute: "veg", active: "1" },
    { attributeid: "2", attribute: "non-veg", active: "1" },
    { attributeid: "24", attribute: "egg", active: "1" },
  ];

  return {
    success: "1",
    restaurants: [
      {
        restaurantid: "default",
        details: {
          restaurantname: "Wellness Foods",
        },
      },
    ],
    categories,
    items,
    addongroups: addonGroups,
    attributes,
    variations: variationsList,
  } as any;
}
