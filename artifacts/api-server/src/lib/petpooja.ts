import { sql, eq } from "drizzle-orm";
import { type InsertMenuItem, type MenuItem, type InsertOrder, type OrderStatus, type OrderChannel, orderStatusLadderRank, orderStatusAcceptsExternalUpdate, isOrderStatus, usersTable, menuItemsTable } from "@workspace/db/schema";

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
          // The originating channel, e.g. "Zomato" / "Swiggy". Petpooja's READ
          // API (get_orders_api) reports this; whether their push payload
          // carries it is unconfirmed with the vendor, so it is optional and
          // its absence is handled — see mapPetpoojaOrderChannel. Modelling it
          // is what makes the field survive: req.body is cast straight to this
          // interface, so anything not declared here is silently dropped.
          order_from?: string;
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

/**
 * Petpooja's channel label → our closed `order_channel` vocabulary.
 *
 * Petpooja's read API reports the channel as `order_from` with values like
 * "Zomato" / "Swiggy"; per the live probe this outlet's orders are
 * overwhelmingly Zomato. Whether the push payload carries the same field is
 * unconfirmed with the vendor (claude/order-channel-split.md §7), so this is
 * best-effort and degrades in the right direction:
 *
 *   absent / blank        → 'pos'    "arrived via the POS, provenance unstated"
 *   "Zomato" / "Swiggy"   → itself   (case- and whitespace-insensitive)
 *   anything else present → 'other'  keeps the fact that a channel was named
 *
 * It can never return 'own_app'. An order we did not originate must not be
 * able to claim it did — that would put an aggregator's customer straight back
 * onto the clinical console this column exists to keep them off.
 */
export function mapPetpoojaOrderChannel(orderFrom: string | null | undefined): OrderChannel {
  const normalized = (orderFrom ?? "").trim().toLowerCase();
  if (!normalized) return "pos";
  if (normalized === "zomato") return "zomato";
  if (normalized === "swiggy") return "swiggy";
  return "other";
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

  // The aggregator's GRAND total — GST, delivery and packing included — and
  // that is correct here, not the bug it looks like.
  //
  // `total_paise` is documented as "meal subtotal after discounts/credit (NO
  // GST, NO delivery fee)", so writing a gross number into it reads like the
  // inbound twin of the outbound charge-fidelity bug (branch 5). It is not.
  // The invariant the money path actually depends on is stated in
  // paymentIntegrity.ts: `chargePaise ?? totalPaise` IS the payable gross.
  // `charge_paise` is the post-GST number only for orders WE priced; when it is
  // null, `total_paise` carries the gross instead. The guest-checkout path is
  // the sanctioned precedent — checkout.ts writes `totals.total` (GST and fee
  // included) into `totalPaise` and never sets `chargePaise`.
  //
  // This mapper leaves `chargePaise` unset, deliberately: we never charge an
  // aggregator order, the customer paid Zomato. So the gross belongs in
  // `total_paise`, and every reader of `chargePaise ?? totalPaise` gets a true
  // answer — including routes/orders.ts's cancel path, which seeds a refund
  // request at exactly that expression with no channel predicate. "Fixing"
  // this line to a recomputed subtotal would quote an operator less than the
  // customer actually paid.
  //
  // And it would be a number we invented. The payload's components are not
  // guaranteed to reconcile to `total`: in Petpooja's OWN documentation sample
  // (the fixture in petpooja.test.ts) the items come to ₹220, and
  // 220 + 50 delivery + 20 packing + 65.52 tax − 45 discount = ₹310.52 against
  // a stated total of ₹560. Σ(components) is a guess; `total` is the one figure
  // the aggregator asserts.
  //
  // What IS wrong is downstream, and it is not this column's fault: the
  // analytics layer sums `total_paise` across every channel with no way to tell
  // them apart. See claude/order-channel-split.md §6 rows 7-8.
  // petpooja.moneyInvariant.test.ts pins all of the above.
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
    // Never 'own_app' — this order came from the POS, whoever originated it.
    orderChannel: mapPetpoojaOrderChannel(Order.details.order_from),
    // Trimmed because this is a dedupe key, not a label. `uniq_orders_external_pos`
    // compares bytes, so " 4471" and "4471" would be two rows for one meal —
    // exactly the duplicate the index exists to prevent, walking straight past
    // it. Canonicalise once, here, where the value enters the system.
    //
    // Blank collapses to null, not "": a partial index keyed
    // `external_order_id is not null` would happily treat "" as a real id and
    // then dedupe every id-less order onto the first one. Null says what is
    // true — this order has no handle — and keeps it out of the index. The
    // route refuses such a payload outright, so this is the backstop for any
    // other caller.
    externalOrderId: (Order.details.orderID ?? "").trim() || null,
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
 * (ops.ts /kds/orders, ["placed","preparing"]), so on status alone a
 * POS-originated order is visible to every reader that matters. Before this
 * mapper was typed they were not "correctly excluded" — they were accidentally
 * invisible, which is a different and worse thing.
 *
 * What keeps them off our surfaces now is `orders.order_channel`, which is the
 * right tool for it: ops.ts, orders.ts and dispatch.ts filter on the channel,
 * not on a status value no reader understands. The two mechanisms are
 * deliberately separate — status says how far along an order is, channel says
 * whose order it is, and conflating them is what produced the original bug.
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
 * Mapping low also interacts with monotonicity, and the interaction is the good
 * one: an unrecognised string becomes the least advanced rider state, which
 * classifyPosStatusTransition will then refuse to apply to an order that has
 * already moved past it. A guess never drags an order backwards.
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

/**
 * What a Petpooja status webhook is allowed to do to the order it names.
 *
 * The three status routes (/callback, /orderstatus, /rider-info) all used to
 * write the incoming status unconditionally, which made the order's state a
 * function of webhook ARRIVAL order rather than of what actually happened. That
 * is not a hypothetical: webhook delivery is at-least-once and unordered, so a
 * retried `rider-assigned` landing after `pickedup` walked a moving order back
 * to `rider_assigned`, and a replayed accept walked a delivered order back into
 * `preparing`. Backwards moves are not cosmetic — `rider_assigned` is in
 * dispatch.ts's partnerStatuses, so an order that had already left could be
 * batched onto a new one, and `preparing` is on the KDS board, so a delivered
 * meal reappeared as a ticket to cook.
 *
 * Three outcomes rather than a boolean, because "not forward" is two different
 * situations and collapsing them loses information the caller needs:
 *
 *   advance — strictly later on the ladder, or a cancellation from a live rung.
 *             Write the status and anything that belongs to the event.
 *   hold    — the same status we already hold. The status write is a no-op, but
 *             the webhook is NOT stale: this is how a rider REASSIGNMENT
 *             arrives (rider-assigned twice, second time a different courier).
 *             Callers should still take identity-like fields, and must not
 *             re-apply anything that accumulates — see the cancellation-reason
 *             handling in routes/petpooja.ts, which a replay used to prepend
 *             twice.
 *   regress — earlier on the ladder, or any move at all out of a settled state.
 *             The webhook contradicts something we already believe. Write
 *             nothing, and say so in the log.
 *
 * `cancelled` is special-cased as an advance from any live rung on purpose: an
 * outlet can reject an order at any point before it lands, so cancellation is
 * forward motion even though it has no ladder rank. From `delivered` it is a
 * regress — the food is with the customer, and a cancellation arriving after
 * that is a contradiction, not an instruction.
 *
 * Note what this deliberately does NOT do: it is not wired into our own money
 * path. `payments.ts` and the dispatch engine write `orders.status` directly
 * and are unaffected. This is POS-webhook policy — the ladder it consults
 * (orderStatusLadderRank, lib/db) is general, the decision to refuse rather
 * than accept is specific to a channel that cannot be trusted to deliver its
 * events in order.
 */
export type PosStatusTransition = "advance" | "hold" | "regress";

// `from` is `string` rather than `OrderStatus` on purpose. `orders.status` is an
// unconstrained varchar, so a row read back from the database really can hold a
// value this vocabulary has never heard of, and the caller has no honest way to
// narrow it. Deciding what to do about that is this function's job, not the
// route's: an unrecognised current status means we cannot place the order on
// the ladder, and moving an order whose position we cannot establish is exactly
// the mistake the ladder exists to prevent. So it fails closed, as a regress.
export function classifyPosStatusTransition(
  from: string,
  to: OrderStatus
): PosStatusTransition {
  if (!isOrderStatus(from)) return "regress";
  if (from === to) return "hold";
  if (!orderStatusAcceptsExternalUpdate[from]) return "regress";
  if (to === "cancelled") return "advance";

  const fromRank = orderStatusLadderRank[from];
  const toRank = orderStatusLadderRank[to];
  // Unreachable today: everything off the ladder is also settled, so a null
  // `fromRank` was already caught above, and the POS mappers cannot produce an
  // off-ladder `to` other than the `cancelled` handled above. It is here so
  // that a status value added to the vocabulary without a rank fails closed —
  // refusing an update is recoverable, corrupting an order's state is not.
  if (fromRank === null || toRank === null) return "regress";

  return toRank > fromRank ? "advance" : "regress";
}
