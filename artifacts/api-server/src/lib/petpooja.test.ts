import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPetpoojaItem, slugify, serializeMenuToPetpooja, mapPetpoojaOrderToDb, mapPetpoojaStatus, mapPetpoojaRiderStatus } from "./petpooja";
import { usersTable, menuItemsTable } from "@workspace/db/schema";

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
  assert.equal(order.totalPaise, 56000);
  assert.equal(order.fulfillmentType, "delivery");
  assert.equal(order.dropLat, 23.01);
  assert.equal(order.dropLng, 72.02);
  assert.equal(order.priority, "urgent");
  assert.equal(order.deliveryInstructions, "No onions");
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].id, 401);
  assert.equal(order.items[0].name, "Veg Loaded Pizza");
  assert.equal(order.items[0].qty, 2);
  assert.equal(order.items[0].price, 11000);
});

test("mapPetpoojaStatus maps status codes to database statuses", () => {
  assert.equal(mapPetpoojaStatus("1"), "confirmed");
  assert.equal(mapPetpoojaStatus("2"), "cancelled");
  assert.equal(mapPetpoojaStatus("5"), "dispatched");
  assert.equal(mapPetpoojaStatus("6"), "delivered");
  assert.equal(mapPetpoojaStatus("9"), "placed");
});

test("mapPetpoojaRiderStatus maps status string to database status", () => {
  assert.equal(mapPetpoojaRiderStatus("rider-assigned"), "dispatched");
  assert.equal(mapPetpoojaRiderStatus("rider-arrived"), "dispatched");
  assert.equal(mapPetpoojaRiderStatus("pickedup"), "dispatched");
  assert.equal(mapPetpoojaRiderStatus("delivered"), "delivered");
  assert.equal(mapPetpoojaRiderStatus("other"), "dispatched");
});
