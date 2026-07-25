import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPetpoojaItem, slugify, serializeMenuToPetpooja, mapPetpoojaOrderToDb, mapPetpoojaOrderChannel, mapPetpoojaStatus, mapPetpoojaRiderStatus } from "./petpooja";
import { usersTable, menuItemsTable, isMealOrderItem, orderStatusValues, orderChannelValues } from "@workspace/db/schema";

test("slugify helper", () => {
  assert.equal(slugify("Veg Loaded Pizza"), "veg-loaded-pizza");
  assert.equal(slugify("Chocolate cake"), "chocolate-cake");
  assert.equal(slugify("Aglio Olio - Chicken"), "aglio-olio-chicken");
});

test("mapPetpoojaItem maps standard item with allergens and nutrition", () => {
  const item = {
    itemid: "118829149",
    item_categoryid: "500773",
    active: "1",
    in_stock: "2",
    cuisine: ["Italian"],
    itemname: "Veg Loaded Pizza",
    item_attributeid: "1",
    itemdescription: "Veggies and cheese",
    price: "100",
    nutrition: {
      calories: { amount: 250, unit: "kcal" },
      protien: { amount: 12, unit: "g" },
      carbohydrate: { amount: 35, unit: "g" },
      totalFat: { amount: 8, unit: "g" },
      fiber: { amount: 3, unit: "g" },
      allergens: [{ allergen: "gluten", allergenDesc: "gluten" }],
    },
  };

  const categories = [
    { categoryid: "500773", active: "1", categoryname: "Pizza" },
  ];
  const attributes = [
    { attributeid: "1", attribute: "veg", active: "1" },
  ];

  const mapped = mapPetpoojaItem(item as any, categories, [], attributes);

  assert.equal(mapped.name, "Veg Loaded Pizza");
  assert.equal(mapped.slug, "veg-loaded-pizza");
  assert.equal(mapped.pricePaise, 10000);
  assert.equal(mapped.category, "Pizza");
  assert.equal(mapped.isVeg, true);
  assert.equal(mapped.isAvailable, true);
  assert.deepEqual(mapped.allergens, ["gluten"]);
  assert.deepEqual(mapped.cuisineTags, ["Italian"]);
  assert.deepEqual(mapped.macros, {
    kcal: 250,
    proteinG: 12,
    carbsG: 35,
    fatG: 8,
    fiberG: 3,
  });
});

test("mapPetpoojaItem captures extended clinical nutrition when Petpooja sends it", () => {
  const item = {
    itemid: "1",
    item_categoryid: "500773",
    active: "1",
    in_stock: "2",
    itemname: "Grilled Veggie Sandwich",
    item_attributeid: "1",
    price: "449",
    nutrition: {
      foodAmount: { amount: 275, unit: "g" },
      calories: { amount: 420, unit: "kcal" },
      protien: { amount: 18, unit: "g" },
      carbohydrate: { amount: 44, unit: "g" },
      totalFat: { amount: 16, unit: "g" },
      fiber: { amount: 6, unit: "g" },
      sodium: { amount: 640, unit: "mg" },
      totalSugar: { amount: 9, unit: "g" },
      addedSugar: { amount: 2, unit: "g" },
      saturatedFat: { amount: 5, unit: "g" },
      transFat: { amount: 0, unit: "g" },
      cholesterol: { amount: 12, unit: "mg" },
      servingInfo: "1to2people",
    },
  };
  const categories = [{ categoryid: "500773", active: "1", categoryname: "Healthy Sandwiches" }];
  const attributes = [{ attributeid: "1", attribute: "veg", active: "1" }];
  const mapped = mapPetpoojaItem(item as any, categories, [], attributes);
  assert.deepEqual(mapped.macros, {
    kcal: 420,
    proteinG: 18,
    carbsG: 44,
    fatG: 16,
    fiberG: 6,
    sodiumMg: 640,
    totalSugarG: 9,
    addedSugarG: 2,
    saturatedFatG: 5,
    transFatG: 0,
    cholesterolMg: 12,
    servingSize: { amount: 275, unit: "g" },
    servingInfo: "1to2people",
  });
});

test("mapPetpoojaItem maps empty/absent/all-zero nutrition to null macros (never phantom zeros)", () => {
  const base = {
    itemid: "1",
    item_categoryid: "500773",
    active: "1",
    in_stock: "2",
    itemname: "Garlic Bread",
    item_attributeid: "1",
    price: "140",
  };
  const categories = [{ categoryid: "500773", active: "1", categoryname: "Sides" }];
  const attributes = [{ attributeid: "1", attribute: "veg", active: "1" }];
  // Petpooja sends `nutrition: {}` for items whose panel is un-filled.
  assert.equal(mapPetpoojaItem({ ...base, nutrition: {} } as any, categories, [], attributes).macros, null);
  // Nutrition entirely absent.
  assert.equal(mapPetpoojaItem(base as any, categories, [], attributes).macros, null);
  // Present keys but all-zero amounts → still no real data.
  assert.equal(
    mapPetpoojaItem(
      { ...base, nutrition: { calories: { amount: 0, unit: "kcal" }, protien: { amount: 0, unit: "g" } } } as any,
      categories,
      [],
      attributes,
    ).macros,
    null,
  );
});

test("mapPetpoojaItem maps variations to customizations single selection group", () => {
  const item = {
    itemid: "7765809",
    itemallowvariation: "1",
    item_categoryid: "500773",
    active: "1",
    in_stock: "2",
    itemname: "Garlic Bread",
    item_attributeid: "1",
    price: "140",
    variation_groupname: "Quantity",
    variation: [
      {
        id: "7765862",
        variationid: "89058",
        name: "3Pieces",
        groupname: "Quantity",
        price: "140",
        active: "1",
      },
      {
        id: "7765097",
        variationid: "89059",
        name: "6Pieces",
        groupname: "Quantity",
        price: "160",
        active: "1",
      },
    ],
  };

  const categories = [
    { categoryid: "500773", active: "1", categoryname: "Sides" },
  ];
  const attributes = [
    { attributeid: "1", attribute: "veg", active: "1" },
  ];

  const mapped = mapPetpoojaItem(item as any, categories, [], attributes);

  assert.ok(mapped.customizations);
  assert.equal(mapped.customizations.length, 1);
  assert.equal(mapped.customizations[0].groupName, "Quantity");
  assert.equal(mapped.customizations[0].type, "single");
  assert.deepEqual(mapped.customizations[0].options, [
    { name: "3Pieces", priceModifier: 0, default: true },
    { name: "6Pieces", priceModifier: 2000, default: false },
  ]);
});

test("mapPetpoojaItem maps addons to customizations multiple selection groups", () => {
  const item = {
    itemid: "118829149",
    item_categoryid: "500773",
    active: "1",
    in_stock: "2",
    itemname: "Veg Loaded Pizza",
    item_attributeid: "1",
    price: "100",
    addon: [
      {
        addon_group_id: "135707",
        addon_item_selection_min: "0",
        addon_item_selection_max: "4",
      },
    ],
  };

  const categories = [
    { categoryid: "500773", active: "1", categoryname: "Pizza" },
  ];
  const addonGroups = [
    {
      addongroupid: "135707",
      active: "1",
      addongroup_name: "Extra Toppings",
      addongroupitems: [
        { addonitemid: "1150810", addonitem_name: "Egg", addonitem_price: "20", active: "1" },
        { addonitemid: "1150811", addonitem_name: "Jalapenos", addonitem_price: "20", active: "1" },
      ],
    },
  ];
  const attributes = [
    { attributeid: "1", attribute: "veg", active: "1" },
  ];

  const mapped = mapPetpoojaItem(item as any, categories, addonGroups, attributes);

  assert.ok(mapped.customizations);
  assert.equal(mapped.customizations.length, 1);
  assert.equal(mapped.customizations[0].groupName, "Extra Toppings");
  assert.equal(mapped.customizations[0].type, "multiple");
  assert.deepEqual(mapped.customizations[0].options, [
    { name: "Egg", priceModifier: 2000 },
    { name: "Jalapenos", priceModifier: 2000 },
  ]);
});

test("serializeMenuToPetpooja serializes database items to Petpooja schema", () => {
  const dbItems = [
    {
      id: 101,
      slug: "veg-loaded-pizza",
      name: "Veg Loaded Pizza",
      description: "Delicious pizza with veggies",
      pricePaise: 10000,
      category: "Pizza",
      kitchenLocation: "default",
      isVeg: true,
      isAvailable: true,
      tags: ["petpooja:118829149"],
      allergens: ["gluten"],
      cuisineTags: ["Italian"],
      macros: {
        kcal: 250,
        proteinG: 12,
        carbsG: 35,
        fatG: 8,
        fiberG: 3,
      },
      imageUrl: "https://example.com/pizza.jpg",
      customizations: [
        {
          groupName: "Extra Toppings",
          type: "multiple",
          options: [
            { name: "Egg", priceModifier: 2000 },
          ],
        },
      ],
    },
  ];

  const payload = serializeMenuToPetpooja(dbItems as any);

  assert.equal(payload.success, "1");
  assert.equal(payload.items.length, 1);

  const item = payload.items[0];
  assert.equal(item.itemid, "118829149");
  assert.equal(item.itemname, "Veg Loaded Pizza");
  assert.equal(item.price, "100");
  assert.equal(item.item_attributeid, "1"); // veg
  assert.equal(item.item_image_url, "https://example.com/pizza.jpg");
  assert.deepEqual(item.nutrition?.calories, { amount: 250, unit: "kcal" });

  assert.equal(payload.addongroups.length, 1);
  assert.equal(payload.addongroups[0].addongroup_name, "Extra Toppings");
  assert.equal(payload.addongroups[0].addongroupitems.length, 1);
  assert.equal(payload.addongroups[0].addongroupitems[0].addonitem_name, "Egg");
  assert.equal(payload.addongroups[0].addongroupitems[0].addonitem_price, "20");
});

test("mapPetpoojaOrderToDb maps order payload to database order structure", async () => {
  const payload = {
    app_key: "key",
    app_secret: "secret",
    access_token: "token",
    orderinfo: {
      OrderInfo: {
        Restaurant: {
          details: { res_name: "Lounge", address: "Mall", contact_information: "123", restID: "rest12" },
        },
        Customer: {
          details: {
            email: "user@example.com",
            name: "John",
            address: "Amin Society",
            phone: "9090909090",
            latitude: "23.01",
            longitude: "72.02",
          },
        },
        Order: {
          details: {
            orderID: "A-1",
            preorder_date: "2022-01-01",
            preorder_time: "15:50:00",
            delivery_charges: "50",
            packing_charges: "20",
            order_type: "H",
            payment_type: "COD",
            total: "560",
            tax_total: "65.52",
            discount_total: "45",
            urgent_order: true,
            description: "No onions",
            created_on: "2022-01-01 15:49:00",
          },
        },
        OrderItem: {
          details: [
            {
              id: "118829149",
              name: "Veg Loaded Pizza",
              price: "110.00",
              final_price: "110.00",
              quantity: "2",
            },
          ],
        },
      },
    },
  };

  const mockDbClient = {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            if (table === usersTable) {
              return Promise.resolve([{ id: "usr_abc123" }]);
            }
            if (table === menuItemsTable) {
              return Promise.resolve([{ id: 401, name: "Veg Loaded Pizza" }]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
  };

  const order = await mapPetpoojaOrderToDb(payload as any, mockDbClient);

  assert.equal(order.userId, "usr_abc123");
  assert.equal(order.externalOrderId, "A-1");
  // Petpooja pushed it, so it is not ours — even though the customer email
  // matched one of our users and userId got populated. A matching email means
  // "this person has an account with us", not "this order came from our app".
  assert.equal(order.orderChannel, "pos");
  assert.equal(order.totalPaise, 56000);
  assert.equal(order.fulfillmentType, "delivery");
  assert.equal(order.dropLat, 23.01);
  assert.equal(order.dropLng, 72.02);
  assert.equal(order.priority, "urgent");
  assert.equal(order.deliveryInstructions, "No onions");
  assert.equal(order.items.length, 1);
  const [firstItem] = order.items;
  if (!isMealOrderItem(firstItem)) {
    assert.fail("expected mapPetpoojaOrderToDb to produce a meal order item");
  }
  assert.equal(firstItem.id, 401);
  assert.equal(firstItem.name, "Veg Loaded Pizza");
  assert.equal(firstItem.qty, 2);
  assert.equal(firstItem.price, 11000);
});

test("mapPetpoojaOrderChannel normalises Petpooja's order_from", () => {
  // Present and recognised — case and padding are the vendor's business, not
  // ours, so both are normalised away.
  assert.equal(mapPetpoojaOrderChannel("Zomato"), "zomato");
  assert.equal(mapPetpoojaOrderChannel("zomato"), "zomato");
  assert.equal(mapPetpoojaOrderChannel("  Swiggy  "), "swiggy");

  // Absent, blank, or whitespace — the field may not exist on the push
  // contract at all, so silence must land somewhere honest: 'pos' says
  // "reached us through the POS, provenance unstated".
  assert.equal(mapPetpoojaOrderChannel(undefined), "pos");
  assert.equal(mapPetpoojaOrderChannel(null), "pos");
  assert.equal(mapPetpoojaOrderChannel(""), "pos");
  assert.equal(mapPetpoojaOrderChannel("   "), "pos");

  // Present but unknown — keeps the fact that a channel WAS named, which
  // 'pos' would throw away. A new aggregator shows up as 'other' rather than
  // being quietly indistinguishable from an unlabelled POS order.
  assert.equal(mapPetpoojaOrderChannel("Magicpin"), "other");
  assert.equal(mapPetpoojaOrderChannel("DotPe"), "other");
});

test("mapPetpoojaOrderChannel can never return own_app", () => {
  // The load-bearing invariant. An order we did not originate must not be
  // able to claim it did — 'own_app' is what the RD console, the KDS and the
  // dispatcher will filter on, so a channel mapper that can emit it puts an
  // aggregator's customer back onto a clinical surface.
  const inputs = [
    "own_app",
    "OWN_APP",
    " own_app ",
    "Tanmatra",
    "app",
    "Own App",
    "direct",
    ...orderChannelValues,
  ];
  for (const input of inputs) {
    assert.notEqual(
      mapPetpoojaOrderChannel(input),
      "own_app",
      `mapPetpoojaOrderChannel(${JSON.stringify(input)}) must not claim own_app`,
    );
  }
});

test("mapPetpoojaOrderChannel only ever returns a value the DB accepts", () => {
  const inputs = [undefined, null, "", "Zomato", "swiggy", "Magicpin", "🍕", "a".repeat(200)];
  for (const input of inputs) {
    const channel = mapPetpoojaOrderChannel(input);
    assert.ok(
      (orderChannelValues as readonly string[]).includes(channel),
      `${JSON.stringify(input)} produced ${channel}, which orders_order_channel_chk would reject`,
    );
  }
});

test("mapPetpoojaOrderToDb records the channel Petpooja names", async () => {
  const mockDbClient = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
  };
  const payloadWith = (orderFrom?: string) => ({
    app_key: "key",
    app_secret: "secret",
    access_token: "token",
    orderinfo: {
      OrderInfo: {
        Restaurant: { details: { res_name: "L", address: "M", contact_information: "1", restID: "r" } },
        Customer: { details: { email: "nobody@example.com", name: "N", address: "A", phone: "9" } },
        Order: {
          details: {
            orderID: "Z-1",
            preorder_date: "",
            preorder_time: "",
            delivery_charges: "0",
            packing_charges: "0",
            order_type: "H",
            payment_type: "COD",
            total: "100",
            tax_total: "0",
            discount_total: "0",
            created_on: "",
            ...(orderFrom === undefined ? {} : { order_from: orderFrom }),
          },
        },
        OrderItem: { details: [] },
      },
    },
  });

  const zomato = await mapPetpoojaOrderToDb(payloadWith("Zomato") as any, mockDbClient);
  assert.equal(zomato.orderChannel, "zomato");
  // The unmatched-customer case: userId stays null, which is exactly the row
  // the (user_id, external_order_id) unique index cannot deduplicate. The
  // channel is what a channel-scoped index will key on instead.
  assert.equal(zomato.userId, null);

  const unlabelled = await mapPetpoojaOrderToDb(payloadWith() as any, mockDbClient);
  assert.equal(unlabelled.orderChannel, "pos");
});

test("mapPetpoojaStatus maps status codes to database statuses", () => {
  // "1" = Accepted. There is no "confirmed" state — acceptance is the start
  // of prep, and `preparing` is what our own money path writes on capture.
  assert.equal(mapPetpoojaStatus("1"), "preparing");
  assert.equal(mapPetpoojaStatus("-1"), "cancelled");
  assert.equal(mapPetpoojaStatus("2"), "cancelled");
  assert.equal(mapPetpoojaStatus("5"), "out_for_delivery");
  assert.equal(mapPetpoojaStatus("6"), "delivered");
  assert.equal(mapPetpoojaStatus("9"), "placed");
  assert.equal(mapPetpoojaStatus(""), "placed");
});

test("mapPetpoojaRiderStatus maps status string to database status", () => {
  assert.equal(mapPetpoojaRiderStatus("rider-assigned"), "rider_assigned");
  assert.equal(mapPetpoojaRiderStatus("rider-arrived"), "rider_assigned");
  // Picked up = moving. Distinct from rider_assigned because dispatch.ts's
  // partnerStatuses batches rider_assigned orders and must not batch this one.
  assert.equal(mapPetpoojaRiderStatus("pickedup"), "out_for_delivery");
  assert.equal(mapPetpoojaRiderStatus("delivered"), "delivered");
  assert.equal(mapPetpoojaRiderStatus("DELIVERED"), "delivered");
  assert.equal(mapPetpoojaRiderStatus("PickedUp"), "out_for_delivery");
  // Unknown guesses LOW, never high — over-stating progress would strip the
  // order out of the batching pool and lie to the customer.
  assert.equal(mapPetpoojaRiderStatus("other"), "rider_assigned");
});

// The regression this file exists to prevent. Both mappers previously returned
// "confirmed" / "dispatched", values no reader in the system recognises, so a
// POS-driven order vanished from the customer's active list, the dispatch
// sweep and the storefront tracker. These assertions are deliberately stated
// against the SHARED vocabulary rather than against literals, so adding a new
// Petpooja code cannot reintroduce a private dialect.
test("both mappers only ever emit the shared order-status vocabulary", () => {
  const vocabulary: ReadonlySet<string> = new Set(orderStatusValues);
  for (const code of ["1", "-1", "2", "5", "6", "9", "", "999"]) {
    assert.ok(
      vocabulary.has(mapPetpoojaStatus(code)),
      `mapPetpoojaStatus(${JSON.stringify(code)}) → ${mapPetpoojaStatus(code)} is not in orderStatusValues`,
    );
  }
  for (const s of ["rider-assigned", "rider-arrived", "pickedup", "delivered", "", "surprise"]) {
    assert.ok(
      vocabulary.has(mapPetpoojaRiderStatus(s)),
      `mapPetpoojaRiderStatus(${JSON.stringify(s)}) → ${mapPetpoojaRiderStatus(s)} is not in orderStatusValues`,
    );
  }
});

// The vocabulary is only worth having if the readers actually accept it. These
// are the live allowlists, copied here so that narrowing one of them without
// thinking about the Petpooja seam fails a test instead of silently hiding
// POS orders again.
//
// These cover the STATUS axis only. Those same readers now apply a second,
// independent predicate — `order_channel = 'own_app'` — which is what actually
// keeps a POS order off our board and away from our riders. The test below
// this one covers that axis and their interaction; neither is redundant,
// because a status bug and a channel bug fail in opposite directions (invisible
// vs. wrongly visible). Keep in sync with:
//   artifacts/api-server/src/routes/orders.ts:56   ACTIVE_STATUSES
//   artifacts/api-server/src/routes/ops.ts         /kds/orders filter
//   artifacts/api-server/src/lib/dispatch.ts:331   partnerStatuses
//   artifacts/storefront/lib/orderStatus.ts:52     TRACKABLE_STATUSES
test("every mapped in-flight status is visible to the readers that matter", () => {
  const ordersActive = ["placed", "preparing", "ready", "out_for_delivery"];
  const kdsQueue = ["placed", "preparing"];
  const dispatchPartner = ["rider_assigned", "ready"];
  const storefrontTrackable = [
    "placed",
    "preparing",
    "ready",
    "rider_assigned",
    "out_for_delivery",
  ];

  // Accepted by the POS → in the customer's active list AND on the KDS board.
  assert.ok(ordersActive.includes(mapPetpoojaStatus("1")));
  assert.ok(kdsQueue.includes(mapPetpoojaStatus("1")));
  assert.ok(storefrontTrackable.includes(mapPetpoojaStatus("1")));

  // Dispatched by the POS → still active, still trackable, NOT batchable.
  assert.ok(ordersActive.includes(mapPetpoojaStatus("5")));
  assert.ok(storefrontTrackable.includes(mapPetpoojaStatus("5")));
  assert.ok(!dispatchPartner.includes(mapPetpoojaStatus("5")));

  // Rider assigned → trackable AND still eligible for batching.
  assert.ok(dispatchPartner.includes(mapPetpoojaRiderStatus("rider-assigned")));
  assert.ok(storefrontTrackable.includes(mapPetpoojaRiderStatus("rider-assigned")));

  // Picked up → trackable, no longer batchable.
  assert.ok(storefrontTrackable.includes(mapPetpoojaRiderStatus("pickedup")));
  assert.ok(!dispatchPartner.includes(mapPetpoojaRiderStatus("pickedup")));
});

// The channel axis of the same seam. Models the predicate the narrowed readers
// actually apply, so the two dimensions can be reasoned about together:
// status decides whether a row is in flight, channel decides whether it is ours.
function passesOwnAppReader(row: {
  orderKind: string;
  orderChannel: string;
  status: string;
}, statusAllowlist: readonly string[]): boolean {
  return (
    row.orderKind === "meal" &&
    row.orderChannel === "own_app" &&
    statusAllowlist.includes(row.status)
  );
}

test("no Petpooja status can put a POS order on an own-app surface", () => {
  const ordersActive = ["placed", "preparing", "ready", "out_for_delivery"];
  const kdsQueue = ["placed", "preparing"];
  const dispatchLive = ["placed", "preparing", "ready", "rider_assigned"];

  // Every status code Petpooja can send us, including the ones that map to a
  // very-much-in-flight state. `order_from` is absent here, which is the
  // realistic case: Petpooja has not confirmed the push carries that field.
  for (const code of ["1", "-1", "2", "5", "6", "0", "", "99"]) {
    const row = {
      orderKind: "meal",
      orderChannel: mapPetpoojaOrderChannel(undefined),
      status: mapPetpoojaStatus(code),
    };
    for (const allowlist of [ordersActive, kdsQueue, dispatchLive]) {
      assert.equal(
        passesOwnAppReader(row, allowlist),
        false,
        `Petpooja status ${JSON.stringify(code)} → ${row.status} reached an own-app reader`,
      );
    }
  }

  // ...and the exclusion must come from the channel, not from the status
  // happening to fall outside every allowlist. Without this the test above
  // could pass for entirely the wrong reason and keep passing after someone
  // deletes the channel predicate.
  const accepted = { orderKind: "meal", orderChannel: "own_app", status: mapPetpoojaStatus("1") };
  assert.equal(passesOwnAppReader(accepted, ordersActive), true);
  assert.equal(passesOwnAppReader(accepted, kdsQueue), true);

  // Named aggregators are excluded by the same single predicate — there is no
  // per-aggregator list to keep up to date, which is the point of the column.
  for (const channel of orderChannelValues.filter((c) => c !== "own_app")) {
    assert.equal(
      passesOwnAppReader({ ...accepted, orderChannel: channel }, ordersActive),
      false,
      `channel ${channel} reached an own-app reader`,
    );
  }
});
