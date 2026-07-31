import { z } from "zod/v4";

/**
 * Zod schemas for every Petpooja webhook payload (routes/petpooja.ts).
 *
 * These mirror the `Petpooja*Payload` interfaces in ./petpooja.ts as closely
 * as possible, but are deliberately no *stricter* than what the handlers
 * already tolerate: fields the code reads with `?? []` / `?.` / a fallback
 * stay optional here too. The goal is to turn a malformed field (wrong type,
 * missing required nesting) into a clean 400 instead of a TypeError deep
 * inside the mapper — not to reject shapes Petpooja is already allowed to
 * send. `.passthrough()` everywhere so an unrecognized vendor field never
 * fails validation; that has always been the effective behavior of the `as
 * PayloadType` casts these schemas replace.
 */

const amount = z.object({ amount: z.number(), unit: z.string() }).passthrough();

const petpoojaItemSchema = z
  .object({
    itemid: z.string(),
    // Declared required on PetpoojaItem, but mapPetpoojaItem never reads any
    // of these seven — they're pass-through fields Petpooja doesn't always
    // send (push-menu payloads with a trimmed item shape omit them). Required
    // here would 400 a payload the handler has always accepted.
    itemallowvariation: z.string().optional(),
    itemrank: z.string().optional(),
    item_categoryid: z.string(),
    item_ordertype: z.string().optional(),
    item_tags: z.array(z.string()).optional(),
    item_packingcharges: z.string().optional(),
    itemallowaddon: z.string().optional(),
    itemaddonbasedon: z.string().optional(),
    item_favorite: z.string().optional(),
    ignore_taxes: z.string().optional(),
    ignore_discounts: z.string().optional(),
    in_stock: z.string(),
    itemname: z.string(),
    item_attributeid: z.string(),
    // Read with `item.itemdescription || ""` — optional here matches that
    // fallback exactly.
    itemdescription: z.string().optional(),
    minimumpreparationtime: z.string().optional(),
    price: z.string(),
    active: z.string(),
    item_image_url: z.string().optional(),
    cuisine: z.array(z.string()).optional(),
    variation: z
      .array(
        z
          .object({
            id: z.string(),
            variationid: z.string(),
            name: z.string(),
            groupname: z.string(),
            price: z.string(),
            active: z.string(),
          })
          .passthrough(),
      )
      .optional(),
    variation_groupname: z.string().optional(),
    addon: z
      .array(
        z
          .object({
            addon_group_id: z.string(),
            addon_item_selection_min: z.string(),
            addon_item_selection_max: z.string(),
          })
          .passthrough(),
      )
      .optional(),
    // Mirrors Petpooja's misspelled `protien` key verbatim — see petpooja.ts.
    nutrition: z
      .object({
        foodAmount: amount.optional(),
        calories: amount.optional(),
        protien: amount.optional(),
        carbohydrate: amount.optional(),
        totalFat: amount.optional(),
        fiber: amount.optional(),
        sodium: amount.optional(),
        totalSugar: amount.optional(),
        addedSugar: amount.optional(),
        saturatedFat: amount.optional(),
        transFat: amount.optional(),
        cholesterol: amount.optional(),
        servingInfo: z.string().optional(),
        allergens: z
          .array(z.object({ allergen: z.string(), allergenDesc: z.string() }).passthrough())
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const petpoojaCategorySchema = z
  .object({ categoryid: z.string(), categoryname: z.string(), active: z.string() })
  .passthrough();

const petpoojaAddonGroupSchema = z
  .object({
    addongroupid: z.string(),
    addongroup_name: z.string(),
    active: z.string(),
    addongroupitems: z.array(
      z
        .object({
          addonitemid: z.string(),
          addonitem_name: z.string(),
          addonitem_price: z.string(),
          active: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const petpoojaAttributeSchema = z
  .object({ attributeid: z.string(), attribute: z.string(), active: z.string() })
  .passthrough();

// push-menu — categories/addongroups/attributes are `?? []`'d by the handler,
// so they stay optional; `items` is the one field the current manual check
// already requires.
export const petpoojaPushMenuSchema = z
  .object({
    success: z.string().optional(),
    restaurants: z
      .array(
        z
          .object({
            restaurantid: z.string(),
            details: z.object({ restaurantname: z.string() }).passthrough(),
          })
          .passthrough(),
      )
      .optional(),
    categories: z.array(petpoojaCategorySchema).optional(),
    items: z.array(petpoojaItemSchema),
    addongroups: z.array(petpoojaAddonGroupSchema).optional(),
    attributes: z.array(petpoojaAttributeSchema).optional(),
  })
  .passthrough();

// saveorder — Restaurant/Customer/Order/OrderItem are all dereferenced
// unconditionally downstream (mapPetpoojaOrderToDb), so they're required
// here; a payload missing one already crashes today, this just turns that
// crash into a clean 400. `orderID` itself stays optional — the handler's
// own `(Order.details.orderID ?? "").trim() === ""` check is the real gate
// and produces its own specific "missing orderID" message.
const petpoojaSaveOrderItemDetail = z
  .object({
    id: z.string(),
    name: z.string(),
    price: z.string(),
    final_price: z.string(),
    quantity: z.string(),
    variation_id: z.string().optional(),
    variation_name: z.string().optional(),
    AddonItem: z
      .object({
        details: z.array(
          z
            .object({ id: z.string(), name: z.string(), price: z.string(), quantity: z.string() })
            .passthrough(),
        ),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const petpoojaSaveOrderSchema = z
  .object({
    app_key: z.string(),
    app_secret: z.string(),
    access_token: z.string(),
    orderinfo: z
      .object({
        OrderInfo: z
          .object({
            Restaurant: z
              .object({
                details: z
                  .object({
                    res_name: z.string(),
                    address: z.string(),
                    contact_information: z.string(),
                    restID: z.string(),
                  })
                  .passthrough(),
              })
              .passthrough(),
            Customer: z
              .object({
                details: z
                  .object({
                    email: z.string(),
                    name: z.string(),
                    address: z.string(),
                    phone: z.string(),
                    latitude: z.string().optional(),
                    longitude: z.string().optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
            Order: z
              .object({
                // Matches PetpoojaSaveOrderPayload exactly (required fields
                // stay required) so this is assignable to mapPetpoojaOrderToDb's
                // parameter type. `orderID` is required-but-string here (so a
                // missing/non-string field is rejected as malformed); the
                // handler's own `(orderID ?? "").trim() === ""` check still
                // catches the empty-string case with its specific message.
                details: z
                  .object({
                    orderID: z.string(),
                    preorder_date: z.string(),
                    preorder_time: z.string(),
                    delivery_charges: z.string(),
                    packing_charges: z.string(),
                    order_type: z.string(),
                    payment_type: z.string(),
                    total: z.string(),
                    tax_total: z.string(),
                    discount_total: z.string(),
                    urgent_order: z.boolean().optional(),
                    description: z.string().optional(),
                    created_on: z.string(),
                    order_from: z.string().optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
            OrderItem: z
              .object({ details: z.array(petpoojaSaveOrderItemDetail) })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

// callback — the handler's own `!payload.orderID || !payload.status` check
// is the real gate; the schema just guarantees the *types* are right when
// present.
export const petpoojaCallbackSchema = z
  .object({
    restID: z.string().optional(),
    orderID: z.string().optional(),
    status: z.string().optional(),
    cancel_reason: z.string().optional(),
    minimum_prep_time: z.number().optional(),
    minimum_delivery_time: z.string().optional(),
    rider_name: z.string().optional(),
    rider_phone_number: z.string().optional(),
    is_modified: z.string().optional(),
  })
  .passthrough();

export const petpoojaUpdateOrderStatusSchema = z
  .object({
    app_key: z.string().optional(),
    app_secret: z.string().optional(),
    access_token: z.string().optional(),
    restID: z.string().optional(),
    orderID: z.string().optional(),
    clientorderID: z.string().optional(),
    cancelReason: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const petpoojaRiderInfoSchema = z
  .object({
    app_key: z.string().optional(),
    app_secret: z.string().optional(),
    access_token: z.string().optional(),
    order_id: z.union([z.string(), z.number()]).optional(),
    outlet_id: z.string().optional(),
    status: z.string().optional(),
    rider_data: z
      .object({ rider_name: z.string(), rider_phone_number: z.string() })
      .passthrough()
      .optional(),
    external_order_id: z.string().optional(),
  })
  .passthrough();

export const petpoojaItemStockSchema = z
  .object({
    type: z.string().optional(),
    // Written straight to menu_items.is_available (a boolean column) below —
    // required as a real boolean so a wrongly-typed payload 400s here
    // instead of failing obscurely at the DB driver.
    inStock: z.boolean().optional(),
    itemID: z.array(z.union([z.string(), z.number()])).optional(),
    restID: z.string().optional(),
  })
  .passthrough();

export const petpoojaItemStockOffSchema = petpoojaItemStockSchema.extend({
  autoTurnOnTime: z.string().optional(),
  customTurnOnTime: z.string().optional(),
});

export const petpoojaFetchMenuSchema = z.object({ restID: z.string().optional() }).passthrough();

export const petpoojaGetStoreStatusSchema = z
  .object({ restID: z.string().optional() })
  .passthrough();

export const petpoojaUpdateStoreStatusSchema = z
  .object({
    restID: z.string().optional(),
    store_status: z.union([z.string(), z.number()]).optional(),
    turn_on_time: z.string().optional(),
    reason: z.string().optional(),
  })
  .passthrough();
