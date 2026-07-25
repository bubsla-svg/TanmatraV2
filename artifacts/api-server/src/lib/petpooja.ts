import { sql, eq } from "drizzle-orm";
import { type InsertMenuItem, type MenuItem, type InsertOrder, type OrderStatus, usersTable, menuItemsTable } from "@workspace/db/schema";

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
  // Mirrors Petpooja's push_menu `nutrition` object verbatim — including their
  // misspelled `protien` key. Do NOT "correct" the spelling: it must match the
  // wire format or the value is silently dropped.
  nutrition?: {
    foodAmount?: { amount: number; unit: string };
    calories?: { amount: number; unit: string };
    protien?: { amount: number; unit: string };
    carbohydrate?: { amount: number; unit: string };
    totalFat?: { amount: number; unit: string };
    fiber?: { amount: number; unit: string };
    sodium?: { amount: number; unit: string };
    totalSugar?: { amount: number; unit: string };
    addedSugar?: { amount: number; unit: string };
    saturatedFat?: { amount: number; unit: string };
    transFat?: { amount: number; unit: string };
    cholesterol?: { amount: number; unit: string };
    servingInfo?: string;
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

export interface PetpoojaSaveOrderPayload {
  app_key: string;
  app_secret: string;
  access_token: string;
  orderinfo: {
    OrderInfo: {
      Restaurant: {
        details: {
          res_name: string;
          address: string;
          contact_information: string;
          restID: string;
        };
      };
      Customer: {
        details: {
          email: string;
          name: string;
          address: string;
          phone: string;
          latitude?: string;
          longitude?: string;
        };
      };
      Order: {
        details: {
          orderID: string;
          preorder_date: string;
          preorder_time: string;
          delivery_charges: string;
          packing_charges: string;
          order_type: string;
          payment_type: string;
          total: string;
          tax_total: string;
          discount_total: string;
          urgent_order?: boolean;
          description?: string;
          created_on: string;
        };
      };
      OrderItem: {
        details: Array<{
          id: string;
          name: string;
          price: string;
          final_price: string;
          quantity: string;
          variation_id?: string;
          variation_name?: string;
          AddonItem?: {
            details: Array<{
              id: string;
              name: string;
              price: string;
              quantity: string;
            }>;
          };
        }>;
      };
    };
  };
}

export interface PetpoojaCallbackPayload {
  restID: string;
  orderID: string;
  status: string;
  cancel_reason?: string;
  minimum_prep_time?: number;
  minimum_delivery_time?: string;
  rider_name?: string;
  rider_phone_number?: string;
  is_modified?: string;
}

export interface PetpoojaUpdateOrderStatusPayload {
  app_key: string;
  app_secret: string;
  access_token: string;
  restID: string;
  orderID?: string;
  clientorderID: string;
  cancelReason: string;
  status: string;
}

export interface PetpoojaRiderInfoPayload {
  app_key: string;
  app_secret: string;
  access_token: string;
  order_id: string | number;
  outlet_id: string;
  status: string;
  rider_data?: {
    rider_name: string;
    rider_phone_number: string;
  };
  external_order_id?: string;
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
): Omit<InsertMenuItem, "contraindications" | "macros"> & { contraindications?: string[]; macros: typeof menuItemsTable.$inferInsert["macros"] } {
  const slug = slugify(item.itemname);

  const cat = categories.find((c) => c.categoryid === item.item_categoryid);
  const category = cat ? cat.categoryname : "uncategorized";

  const attr = attributes.find((a) => a.attributeid === item.item_attributeid);
  const isVeg = attr ? attr.attribute === "veg" : true;

  const isAvailable =
    item.active === "1" &&
    (item.in_stock === "1" || item.in_stock === "2" || item.in_stock === "true");

  const pricePaise = Math.round(parseFloat(item.price || "0") * 100);

  const allergens =
    item.nutrition?.allergens?.map((a) => a.allergen) ?? [];

  // Petpooja sends `nutrition: {}` (empty) for items whose nutrition panel is
  // un-filled — guard against that so it maps to null (→ "pending"), not a
  // misleading all-zero macro row.
  const n = item.nutrition;
  const hasNutrition =
    !!n &&
    (Number(n.calories?.amount ?? 0) > 0 ||
      Number(n.protien?.amount ?? 0) > 0 ||
      Number(n.carbohydrate?.amount ?? 0) > 0 ||
      Number(n.totalFat?.amount ?? 0) > 0);
  // Base four (+fiber) always present; extended clinical fields only when
  // Petpooja actually sends them — no phantom zeros polluting the row.
  const macros = hasNutrition
    ? {
        kcal: Number(n!.calories?.amount ?? 0),
        proteinG: Number(n!.protien?.amount ?? 0),
        carbsG: Number(n!.carbohydrate?.amount ?? 0),
        fatG: Number(n!.totalFat?.amount ?? 0),
        fiberG: Number(n!.fiber?.amount ?? 0),
        ...(n!.sodium ? { sodiumMg: Number(n!.sodium.amount ?? 0) } : {}),
        ...(n!.totalSugar ? { totalSugarG: Number(n!.totalSugar.amount ?? 0) } : {}),
        ...(n!.addedSugar ? { addedSugarG: Number(n!.addedSugar.amount ?? 0) } : {}),
        ...(n!.saturatedFat ? { saturatedFatG: Number(n!.saturatedFat.amount ?? 0) } : {}),
        ...(n!.transFat ? { transFatG: Number(n!.transFat.amount ?? 0) } : {}),
        ...(n!.cholesterol ? { cholesterolMg: Number(n!.cholesterol.amount ?? 0) } : {}),
        ...(n!.foodAmount
          ? {
              servingSize: {
                amount: Number(n!.foodAmount.amount ?? 0),
                unit: String(n!.foodAmount.unit ?? "g"),
              },
            }
          : {}),
        ...(n!.servingInfo ? { servingInfo: n!.servingInfo } : {}),
      }
    : null;

  const customizations: Array<{
    groupName: string;
    type: "single" | "multiple";
    options: Array<{
      name: string;
      priceModifier: number;
      default?: boolean;
    }>;
  }> = [];

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
  const categoriesMap = new Map<string, string>();
  const addonGroupsMap = new Map<string, PetpoojaAddonGroup>();
  const variationsList: Array<{ variationid: string; name: string; groupname: string; status: string }> = [];

  let nextCategoryId = 500000;
  let nextAddonGroupId = 130000;
  let nextAddonItemId = 1100000;
  let nextVariationId = 80000;

  const items: PetpoojaItem[] = dbItems.map((dbItem) => {
    const itemid = extractPetpoojaId(dbItem.tags) || dbItem.id.toString();

    let categoryid = categoriesMap.get(dbItem.category);
    if (!categoryid) {
      categoryid = (nextCategoryId++).toString();
      categoriesMap.set(dbItem.category, categoryid);
    }

    const item_attributeid = dbItem.isVeg ? "1" : "2";

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

export async function mapPetpoojaOrderToDb(
  payload: PetpoojaSaveOrderPayload,
  dbClient: any
): Promise<InsertOrder> {
  const { Customer, Order, OrderItem } = payload.orderinfo.OrderInfo;

  let userId: string | null = null;
  if (Customer.details.email) {
    const [user] = await dbClient
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, Customer.details.email))
      .limit(1);
    if (user) {
      userId = user.id;
    }
  }

  const mappedItems: Array<{ id: number; name: string; qty: number; price: number }> = [];
  for (const item of OrderItem.details) {
    const [dbItem] = await dbClient
      .select()
      .from(menuItemsTable)
      .where(
        sql`${menuItemsTable.tags} @> ${JSON.stringify([`petpooja:${item.id}`])}::jsonb`
      )
      .limit(1);

    const localId = dbItem ? dbItem.id : parseInt(item.id) || 0;
    mappedItems.push({
      id: localId,
      name: item.name,
      qty: parseInt(item.quantity || "1"),
      price: Math.round(parseFloat(item.price || "0") * 100),
    });
  }

  const totalPaise = Math.round(parseFloat(Order.details.total || "0") * 100);

  let fulfillmentType = "delivery";
  if (Order.details.order_type === "P") {
    fulfillmentType = "pickup";
  } else if (Order.details.order_type === "D") {
    fulfillmentType = "dinein";
  }

  const dropLat = Customer.details.latitude ? parseFloat(Customer.details.latitude) : null;
  const dropLng = Customer.details.longitude ? parseFloat(Customer.details.longitude) : null;

  return {
    userId,
    externalOrderId: Order.details.orderID,
    status: "placed",
    totalPaise,
    addressLabel: "Delivery Address",
    addressLine: Customer.details.address || "",
    phone: Customer.details.phone || "",
    dropLat,
    dropLng,
    items: mappedItems,
    fulfillmentType,
    priority: Order.details.urgent_order ? "urgent" : "routine",
    ecoPackagingOptIn: 0,
    deliveryInstructions: Order.details.description || "",
  };
}

/**
 * Petpooja numeric order status → our order-status vocabulary.
 *
 * The return type is `OrderStatus` (lib/db/src/schema/orders.ts) on purpose.
 * These two mappers used to return `string` and emitted "confirmed" and
 * "dispatched" — two values NOTHING in the system reads. Neither appears in
 * orders.ts's ACTIVE_STATUSES or CANCELLABLE, payments.ts's PAID_STATES,
 * dispatch.ts's liveStatuses or partnerStatuses, etaModel.ts's ACTIVE_STATUSES,
 * the ops.ts KDS queue filter, or the storefront's TRACKABLE_STATUSES. An order
 * the POS moved to either one silently dropped out of the customer's active
 * list, the dispatch sweep and the tracker — losing tracking at exactly the
 * moment the food was on its way. Typing the return closes that door.
 *
 * Petpooja's codes (per the Online Ordering API status callback):
 *   1  Accepted        — the kitchen has taken the order and started on it.
 *                        We have no separate "confirmed" state; acceptance IS
 *                        the start of prep, so this is `preparing` (which is
 *                        also what our own money path writes on payment
 *                        capture — payments.ts:477).
 *   -1 Cancelled by outlet, 2 Rejected — both terminal, both `cancelled`.
 *   5  Dispatched      — out the door with a rider: `out_for_delivery`.
 *   6  Delivered       — `delivered`.
 *   anything else      — `placed`, the safe pre-kitchen default.
 *
 * Consequence worth stating: `preparing` is in the KDS queue filter
 * (ops.ts /kds/orders, ["placed","preparing"] + orderKind='meal'), so
 * POS-originated orders now surface in the Tanmatra KDS. That is correct.
 * Before this they were not "correctly excluded" — they were accidentally
 * invisible. Excluding aggregator (Zomato/Swiggy) orders is a job for an
 * order-channel column, not for a status value no reader understands.
 */
export function mapPetpoojaStatus(petpoojaStatus: string): OrderStatus {
  switch (petpoojaStatus) {
    case "1":
      return "preparing";
    case "-1":
    case "2":
      return "cancelled";
    case "5":
      return "out_for_delivery";
    case "6":
      return "delivered";
    default:
      return "placed";
  }
}

/**
 * Petpooja rider-info status string → our order-status vocabulary.
 *
 * The two rider states are distinct for us and must not be collapsed:
 * `rider_assigned` is in dispatch.ts's partnerStatuses (so a rider-assigned
 * order can still be batched with a nearby one) while `out_for_delivery` is
 * not — once the food is moving, batching it is wrong.
 *
 * An unrecognised string maps to `rider_assigned`, the LEAST advanced of the
 * rider states. Guessing low is the safe direction: over-stating progress
 * would strip an order out of the batching pool and tell the customer the
 * food had left when it had not.
 *
 * Still open (pre-existing, not introduced here): neither this mapper's caller
 * nor the /callback and /orderstatus callers guard monotonicity, so an
 * out-of-order or replayed webhook can walk an order BACKWARDS — including out
 * of `delivered`. That was already true when these mappers returned "confirmed"
 * and "dispatched"; making the values real does not create it. The fix belongs
 * with the webhook handlers in routes/petpooja.ts, not here.
 */
export function mapPetpoojaRiderStatus(status: string): OrderStatus {
  switch (status.toLowerCase()) {
    case "delivered":
      return "delivered";
    case "pickedup":
      return "out_for_delivery";
    case "rider-assigned":
    case "rider-arrived":
      return "rider_assigned";
    default:
      return "rider_assigned";
  }
}
