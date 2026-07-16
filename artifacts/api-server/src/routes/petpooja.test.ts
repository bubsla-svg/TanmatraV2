import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express } from "express";
import { usersTable, menuItemsTable, ordersTable, ridersTable } from "@workspace/db/schema";

// Set a dummy DATABASE_URL before importing the DB library so it doesn't throw
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

const { db } = await import("@workspace/db");
const { default: petpoojaRouter } = await import("./petpooja");

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  // Mock logger on request
  app.use((req: any, _res: any, next: any) => {
    req.log = {
      info: () => {},
      error: () => {},
    };
    next();
  });
  app.use(petpoojaRouter);
  return app;
}

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("POST /integrations/petpooja/push-menu rejects invalid payload with 400", async () => {
  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: "1" }), // missing items
  });

  assert.equal(res.status, 400);
  const json: any = await res.json();
  assert.equal(json.success, "0");
  assert.match(json.message, /invalid payload/i);
});

test("POST /integrations/petpooja/push-menu processes valid payload and returns 200", async (t) => {
  // 1. Mock db.transaction to run the callback synchronously
  t.mock.method(db, "transaction", async (cb: any) => {
    const mockTx = {
      insert: () => {
        const mockInsertBuilder = {
          values: () => {
            const mockValuesBuilder = {
              onConflictDoUpdate: () => Promise.resolve([{ id: 1 }]),
            };
            return mockValuesBuilder;
          },
        };
        return mockInsertBuilder;
      },
    };
    return cb(mockTx);
  });

  const payload = {
    success: "1",
    restaurants: [{ restaurantid: "123", details: { restaurantname: "Heaven" } }],
    categories: [{ categoryid: "500773", active: "1", categoryname: "Pizza" }],
    items: [
      {
        itemid: "118829149",
        item_categoryid: "500773",
        active: "1",
        in_stock: "2",
        itemname: "Veg Loaded Pizza",
        item_attributeid: "1",
        price: "100",
      },
    ],
    addongroups: [],
    attributes: [{ attributeid: "1", attribute: "veg", active: "1" }],
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.success, "1");
  assert.equal(json.message, "Menu synchronized successfully");
});

test("POST /integrations/petpooja/fetchmenu returns serialized menu payload", async (t) => {
  // Mock db.select to return dummy items
  t.mock.method(db, "select", () => {
    const mockSelectResult = {
      from: () => Promise.resolve([
        {
          id: 101,
          slug: "garlic-bread",
          name: "Garlic Bread",
          description: "Garlic bread sticks",
          pricePaise: 14000,
          category: "Sides",
          kitchenLocation: "default",
          isVeg: true,
          isAvailable: true,
          tags: ["petpooja:7765809"],
          allergens: [],
          cuisineTags: [],
          macros: null,
          customizations: null,
        },
      ]),
    };
    return mockSelectResult;
  });

  const res = await fetch(`${baseUrl}/integrations/petpooja/fetchmenu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restID: "rest123" }),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.success, "1");
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].itemid, "7765809");
  assert.equal(json.items[0].itemname, "Garlic Bread");
  assert.equal(json.items[0].price, "140");
});

test("POST /integrations/petpooja/saveorder parses payload, inserts order, and returns 200", async (t) => {
  // Mock db.select and db.insert
  t.mock.method(db, "select", () => {
    const mockSelectResult = {
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
    };
    return mockSelectResult;
  });

  t.mock.method(db, "insert", (table: any) => {
    assert.equal(table, ordersTable);
    const mockInsertBuilder = {
      values: (values: any) => {
        assert.equal(values.externalOrderId, "A-1");
        assert.equal(values.totalPaise, 56000);
        assert.equal(values.userId, "usr_abc123");
        const mockValuesBuilder = {
          returning: () => Promise.resolve([{ id: 26 }]),
        };
        return mockValuesBuilder;
      },
    };
    return mockInsertBuilder;
  });

  const payload = {
    app_key: "key",
    app_secret: "secret",
    access_token: "token",
    orderinfo: {
      OrderInfo: {
        Restaurant: {
          details: {
            res_name: "Dynamite Lounge",
            address: "Reliance Mall",
            contact_information: "9427846660",
            restID: "rest123",
          },
        },
        Customer: {
          details: {
            email: "xxx@yahoo.com",
            name: "Advait",
            address: "Amin Society",
            phone: "9090909090",
            latitude: "34.11",
            longitude: "74.72",
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
            urgent_order: false,
            description: "",
            created_on: "2022-01-01 15:49:00",
            service_charge: "0",
            sc_tax_amount: "0",
            dc_tax_percentage: "5",
            dc_tax_amount: "2.5",
            pc_tax_amount: "1",
            pc_tax_percentage: "5",
          },
        },
        OrderItem: {
          details: [
            {
              id: "118829149",
              name: "Veg Loaded Pizza",
              price: "110.00",
              final_price: "110.00",
              quantity: "1",
            },
          ],
        },
      },
    },
    device_type: "Web",
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/saveorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.success, "1");
  assert.equal(json.message, "Your order is saved.");
  assert.equal(json.restID, "rest123");
  assert.equal(json.clientOrderID, "A-1");
  assert.equal(json.orderID, "26");
});

test("POST /integrations/petpooja/callback updates order status and rider info", async (t) => {
  // Mock db.select
  t.mock.method(db, "select", () => {
    const mockSelectResult = {
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            if (table === ordersTable) {
              return Promise.resolve([{ id: 99, externalOrderId: "A-1", status: "placed" }]);
            }
            if (table === ridersTable) {
              return Promise.resolve([]); // no rider exists yet
            }
            return Promise.resolve([]);
          },
        }),
      }),
    };
    return mockSelectResult;
  });

  // Mock db.insert for ridersTable
  t.mock.method(db, "insert", (table: any) => {
    assert.equal(table, ridersTable);
    const mockInsertBuilder = {
      values: (values: any) => {
        assert.equal(values.name, "Rider Joe");
        assert.equal(values.phone, "9876543210");
        const mockValuesBuilder = {
          returning: () => Promise.resolve([{ id: 808 }]),
        };
        return mockValuesBuilder;
      },
    };
    return mockInsertBuilder;
  });

  // Mock db.update for ordersTable
  t.mock.method(db, "update", (table: any) => {
    assert.equal(table, ordersTable);
    const mockUpdateBuilder = {
      set: (values: any) => {
        assert.equal(values.status, "confirmed");
        assert.equal(values.riderId, 808);
        const mockValuesBuilder = {
          where: (condition: any) => Promise.resolve(),
        };
        return mockValuesBuilder;
      },
    };
    return mockUpdateBuilder;
  });

  const payload = {
    restID: "rest123",
    orderID: "A-1",
    status: "1", // Accepted -> confirmed
    cancel_reason: "",
    minimum_prep_time: 20,
    minimum_delivery_time: "",
    rider_name: "Rider Joe",
    rider_phone_number: "9876543210",
    is_modified: "No",
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json: any = await res.json();
  if (res.status !== 200) {
    console.error("FAILED CALLBACK RESPONSE:", json);
  }
  assert.equal(res.status, 200);
  assert.equal(json.success, "1");
  assert.equal(json.message, "Callback processed successfully");
});

test("POST /integrations/petpooja/orderstatus cancels order and saves cancelReason", async (t) => {
  // Mock db.select
  t.mock.method(db, "select", () => {
    const mockSelectResult = {
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            if (table === ordersTable) {
              return Promise.resolve([{ id: 26, externalOrderId: "A-1", status: "placed", deliveryInstructions: "Ring bell" }]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    };
    return mockSelectResult;
  });

  // Mock db.update
  t.mock.method(db, "update", (table: any) => {
    assert.equal(table, ordersTable);
    const mockUpdateBuilder = {
      set: (values: any) => {
        assert.equal(values.status, "cancelled");
        assert.ok(values.deliveryInstructions.includes("Please cancel my order."));
        const mockValuesBuilder = {
          where: (condition: any) => Promise.resolve(),
        };
        return mockValuesBuilder;
      },
    };
    return mockUpdateBuilder;
  });

  const payload = {
    app_key: "key",
    app_secret: "secret",
    access_token: "token",
    restID: "rest123",
    orderID: "26",
    clientorderID: "A-1",
    cancelReason: "Please cancel my order.",
    status: "-1", // cancel status
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/orderstatus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.success, "1");
  assert.equal(json.message, "Order status updated successfully.");
  assert.equal(json.orderID, "26");
  assert.equal(json.status, "-1");
});

test("POST /integrations/petpooja/rider-info resolves order and registers/assigns rider", async (t) => {
  // Mock db.select
  t.mock.method(db, "select", () => {
    const mockSelectResult = {
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            if (table === ordersTable) {
              return Promise.resolve([{ id: 105, externalOrderId: "101010527", status: "confirmed" }]);
            }
            if (table === ridersTable) {
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    };
    return mockSelectResult;
  });

  // Mock db.insert for ridersTable
  t.mock.method(db, "insert", (table: any) => {
    assert.equal(table, ridersTable);
    const mockInsertBuilder = {
      values: (values: any) => {
        assert.equal(values.name, "RIDER");
        assert.equal(values.phone, "9999999999");
        const mockValuesBuilder = {
          returning: () => Promise.resolve([{ id: 909 }]),
        };
        return mockValuesBuilder;
      },
    };
    return mockInsertBuilder;
  });

  // Mock db.update for ordersTable
  t.mock.method(db, "update", (table: any) => {
    assert.equal(table, ordersTable);
    const mockUpdateBuilder = {
      set: (values: any) => {
        assert.equal(values.status, "dispatched");
        assert.equal(values.riderId, 909);
        const mockValuesBuilder = {
          where: (condition: any) => Promise.resolve(),
        };
        return mockValuesBuilder;
      },
    };
    return mockUpdateBuilder;
  });

  const payload = {
    app_key: "key",
    app_secret: "secret",
    access_token: "token",
    order_id: 101010527,
    outlet_id: "outlet123",
    status: "rider-assigned",
    rider_data: {
      rider_name: "RIDER",
      rider_phone_number: "9999999999",
    },
    external_order_id: "",
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/rider-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.code, "200");
  assert.equal(json.message, "Rider status saved successfully.");
  assert.equal(json.success, "success");
});

test("POST /integrations/petpooja/item_stock updates availability status of items", async (t) => {
  let updateCallsCount = 0;

  // Mock db.update for menuItemsTable
  t.mock.method(db, "update", (table: any) => {
    assert.equal(table, menuItemsTable);
    const mockUpdateBuilder = {
      set: (values: any) => {
        assert.equal(values.isAvailable, true);
        const mockValuesBuilder = {
          where: (condition: any) => {
            updateCallsCount++;
            return Promise.resolve();
          },
        };
        return mockValuesBuilder;
      },
    };
    return mockUpdateBuilder;
  });

  const payload = {
    restID: "rest123",
    type: "item",
    inStock: true,
    itemID: ["7778660", "7778659"],
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/item_stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.code, 200);
  assert.equal(json.status, "success");
  assert.equal(json.message, "Stock status updated successfully");
  assert.equal(updateCallsCount, 2);
});

test("POST /integrations/petpooja/item_stock_off marks items as out of stock", async (t) => {
  let updateCallsCount = 0;

  // Mock db.update for menuItemsTable
  t.mock.method(db, "update", (table: any) => {
    assert.equal(table, menuItemsTable);
    const mockUpdateBuilder = {
      set: (values: any) => {
        assert.equal(values.isAvailable, false);
        const mockValuesBuilder = {
          where: (condition: any) => {
            updateCallsCount++;
            return Promise.resolve();
          },
        };
        return mockValuesBuilder;
      },
    };
    return mockUpdateBuilder;
  });

  const payload = {
    restID: "rest123",
    type: "item",
    inStock: false,
    itemID: ["7532306", "7865402"],
    autoTurnOnTime: "custom",
    customTurnOnTime: "2020-02-24 18:00",
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/item_stock_off`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.code, 200);
  assert.equal(json.status, "success");
  assert.equal(json.message, "Stock status updated successfully");
  assert.equal(updateCallsCount, 2);
});

test("POST /integrations/petpooja/get_store_status returns store operational status", async (t) => {
  const payload = {
    restID: "rest123",
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/get_store_status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.http_code, 200);
  assert.equal(json.status, "success");
  assert.equal(json.store_status, "1");
  assert.equal(json.message, "Store Delivery Status fetched successfully");
});

test("POST /integrations/petpooja/update_store_status updates operational status", async (t) => {
  const payload = {
    restID: "rest123",
    store_status: 0,
    turn_on_time: "2023-02-17 00:00:00",
    reason: "maintenance",
  };

  const res = await fetch(`${baseUrl}/integrations/petpooja/update_store_status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.http_code, 200);
  assert.equal(json.status, "success");
  assert.equal(json.message, "Store Status updated successfully for store rest123");
});
