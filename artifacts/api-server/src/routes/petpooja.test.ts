import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express } from "express";

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
  await new Promise<void>((resolve) => server.close(resolve));
});

test("POST /integrations/petpooja/push-menu rejects invalid payload with 400", async () => {
  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: "1" }), // missing items
  });

  assert.equal(res.status, 400);
  const json = await res.json();
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
  const json = await res.json();
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
  const json = await res.json();
  assert.equal(json.success, "1");
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].itemid, "7765809");
  assert.equal(json.items[0].itemname, "Garlic Bread");
  assert.equal(json.items[0].price, "140");
});
