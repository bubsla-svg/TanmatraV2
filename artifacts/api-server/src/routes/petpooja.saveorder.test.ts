/**
 * POST /integrations/petpooja/saveorder must be idempotent, because the thing
 * on the other end retries.
 *
 * The route used to fail in two opposite ways depending on whether the POS
 * order's customer email matched one of our users, which is why neither was
 * obvious from reading it:
 *
 *   - No match (`user_id = null`, i.e. the aggregator case) —
 *     `uniq_orders_user_external` is NULL-blind, so a retry inserted a SECOND
 *     row. Two KDS tickets, two dispatches, one meal, no error anywhere.
 *   - Match — the insert hit that constraint with nothing to catch it, threw,
 *     and returned 500. Petpooja reads 500 as failure and retries, so the
 *     order never lands at all.
 *
 * Both are tested here at the wire level rather than against the DB helpers,
 * because the contract that matters is what Petpooja's client sees: the same
 * 200, with the same orderID, however many times it asks.
 *
 * Two controls keep the assertions honest. Distinct order ids must still
 * produce distinct rows (or "idempotent" would just mean "broken"), and two
 * own-app orders from different users sharing an external id must BOTH insert
 * — that combination is legal today and `uniq_orders_external_pos` is scoped
 * `order_channel <> 'own_app'` precisely so checkout cannot start 500ing on
 * it.
 *
 * Harness mirrors orders.mine.test.ts: test express app, req.log stub, http
 * server on port 0, direct db seeding with after() cleanup. Needs
 * DATABASE_URL, and the database must have migration 0014 applied.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/routes/petpooja.saveorder.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, inArray } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";

import petpoojaRouter from "./petpooja";

// main's inbound Petpooja surface fails closed (landed after this branch was
// cut): unconfigured rejects, and no mode admits a credential-less request.
// These suites exercise idempotency and status-ladder handling, not auth, so
// they configure the integration and authenticate every call with the shared
// secret header. Auth itself is covered by petpooja.auth.test.ts.
// `verifyPetpoojaAuth` calls `petpoojaConfig()` per request, so setting these
// here — after the static import — is sufficient.
process.env.PETPOOJA_APP_KEY = "key-abc";
process.env.PETPOOJA_APP_SECRET = "secret-xyz";
process.env.PETPOOJA_ACCESS_TOKEN = "token-123";
process.env.PETPOOJA_RESTAURANT_ID = "rest-42";
const AUTH = { "x-petpooja-app-secret": "secret-xyz" } as const;


const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `PP-${name}-${RUN}`;

const CREATED_USER_IDS: string[] = [];
const CREATED_EXTERNAL_IDS: string[] = [];

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: Record<string, (...a: unknown[]) => void> }).log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
  app.use(petpoojaRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_EXTERNAL_IDS.length > 0) {
    await db
      .delete(ordersTable)
      .where(inArray(ordersTable.externalOrderId, CREATED_EXTERNAL_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    // Belt and braces: orders reference users, so any row this file created
    // and forgot to track by external id would turn the delete below into an
    // FK violation and mask whatever the tests actually found.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(label: string): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `pp-${label}-${id}@example.test`;
  await db.insert(usersTable).values({ id, email, firstName: label });
  CREATED_USER_IDS.push(id);
  return { id, email };
}

/**
 * A minimal but structurally complete save_order push. `customerEmail`
 * decides which of the two historical failure modes the payload exercises:
 * an address we know maps to a user, an address we don't leaves user_id null.
 */
function payload(opts: { orderID: string; customerEmail?: string; orderFrom?: string }) {
  CREATED_EXTERNAL_IDS.push(opts.orderID.trim());
  return {
    app_key: "test",
    app_secret: "test",
    access_token: "test",
    orderinfo: {
      OrderInfo: {
        Restaurant: {
          details: {
            res_name: "Tanmatra",
            address: "Bengaluru",
            contact_information: "+910000000000",
            restID: "cq5hnj3629",
          },
        },
        Customer: {
          details: {
            email: opts.customerEmail ?? "",
            name: "Aggregator Customer",
            address: "12 Test Road",
            phone: "+919999999999",
          },
        },
        Order: {
          details: {
            orderID: opts.orderID,
            preorder_date: "",
            preorder_time: "",
            delivery_charges: "0",
            packing_charges: "0",
            order_type: "H",
            payment_type: "COD",
            total: "425",
            tax_total: "0",
            discount_total: "0",
            created_on: "2026-07-25 10:00:00",
            ...(opts.orderFrom ? { order_from: opts.orderFrom } : {}),
          },
        },
        OrderItem: { details: [] },
      },
    },
  };
}

async function post(body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}/integrations/petpooja/saveorder`, {
    method: "POST",
    headers: { "content-type": "application/json", ...AUTH },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function rowsFor(externalOrderId: string) {
  return db
    .select({ id: ordersTable.id, userId: ordersTable.userId, channel: ordersTable.orderChannel })
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, externalOrderId));
}

test("a retried aggregator push writes one row and returns the same orderID", async () => {
  // The NULL-blind case: no customer email, so user_id stays null and the old
  // (user_id, external_order_id) index never fires.
  const id = ext("agg");

  const first = await post(payload({ orderID: id, orderFrom: "Zomato" }));
  const second = await post(payload({ orderID: id, orderFrom: "Zomato" }));
  const third = await post(payload({ orderID: id, orderFrom: "Zomato" }));

  for (const [n, r] of [first, second, third].entries()) {
    assert.equal(r.status, 200, `call ${n + 1} did not return 200`);
    assert.equal(r.json.success, "1", `call ${n + 1} did not report success`);
  }
  assert.equal(second.json.orderID, first.json.orderID, "retry invented a new order");
  assert.equal(third.json.orderID, first.json.orderID, "retry invented a new order");
  assert.equal(second.json.clientOrderID, id);

  const rows = await rowsFor(id);
  assert.equal(rows.length, 1, `three pushes produced ${rows.length} rows`);
  assert.equal(rows[0]!.userId, null, "fixture no longer exercises the NULL-blind case");
  assert.equal(rows[0]!.channel, "zomato");
});

test("a retried push for a KNOWN customer returns 200, not the old 500", async () => {
  // The opposite failure: user_id is populated, the old index DOES fire, and
  // without onConflictDoNothing the route threw and answered 500 — which
  // Petpooja retries forever, so the order effectively never lands.
  const user = await makeUser("known");
  const id = ext("known");

  const first = await post(payload({ orderID: id, customerEmail: user.email }));
  const second = await post(payload({ orderID: id, customerEmail: user.email }));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200, "replay for a matched customer still 500s");
  assert.equal(second.json.success, "1");
  assert.equal(second.json.orderID, first.json.orderID);

  const rows = await rowsFor(id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.userId, user.id, "fixture no longer exercises the matched case");
});

test("...but two different order ids are still two orders", async () => {
  // The control. Without it, a route that dropped every write would pass the
  // two tests above perfectly.
  const a = ext("distinct-a");
  const b = ext("distinct-b");

  const first = await post(payload({ orderID: a }));
  const second = await post(payload({ orderID: b }));

  assert.notEqual(second.json.orderID, first.json.orderID, "distinct orders were collapsed");
  assert.equal((await rowsFor(a)).length, 1);
  assert.equal((await rowsFor(b)).length, 1);
});

test("whitespace around the order id does not create a second order", async () => {
  // external_order_id is a dedupe key and the index compares bytes, so the
  // mapper canonicalises it. Without the trim, " X" and "X" are two meals.
  const id = ext("trim");

  const first = await post(payload({ orderID: id }));
  const padded = await post(payload({ orderID: `  ${id}  ` }));

  assert.equal(padded.status, 200);
  assert.equal(padded.json.orderID, first.json.orderID, "a padded id forked the order");
  assert.equal((await rowsFor(id)).length, 1);
});

test("a push with no order id is refused rather than stored", async () => {
  // An order with no external id cannot be deduped, cannot be found by
  // /callback, /orderstatus or /rider-info, and cannot be reconciled. Storing
  // it would create a ticket nobody can ever update.
  for (const orderID of ["", "   "]) {
    const res = await post(payload({ orderID }));
    assert.equal(res.status, 400, `orderID ${JSON.stringify(orderID)} was accepted`);
    assert.equal(res.json.success, "0");
  }
});

test("the new index does not touch own-app orders", async () => {
  // uniq_orders_external_pos is scoped `order_channel <> 'own_app'` on
  // purpose. Own-app external ids come from a client-supplied order id, so two
  // users presenting the same string is legal — and a global unique index
  // would 500 the second user's checkout on a conflict their
  // ON CONFLICT (user_id, external_order_id) spec does not cover. This is the
  // regression test for that, and it is a money-path one.
  const a = await makeUser("own-a");
  const b = await makeUser("own-b");
  const shared = ext("shared-own-app");

  for (const u of [a, b]) {
    await db.insert(ordersTable).values({
      userId: u.id,
      orderChannel: "own_app",
      externalOrderId: shared,
      status: "placed",
      totalPaise: 1000,
      items: [],
      fulfillmentType: "delivery",
    });
  }

  const rows = await rowsFor(shared);
  assert.equal(rows.length, 2, "the POS index leaked onto the own-app checkout path");
});
