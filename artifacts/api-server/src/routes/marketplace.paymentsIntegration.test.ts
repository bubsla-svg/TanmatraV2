/**
 * Proves the marketplace-checkout → Razorpay-billing revenue-leak fix.
 *
 * Before this change, POST /marketplace/checkout wrote its order into
 * marketplace_orders — a table payments.ts never reads. A marketplace
 * checkout would return HTTP 201 and the frontend would treat the cart as
 * placed, but POST /payments/razorpay/order (looked up by
 * ordersTable.externalOrderId) would 404, so nothing was ever billed:
 * the customer walked away with a "placed" order and the merchant
 * collected zero rupees.
 *
 * This test drives both routers end-to-end (real HTTP, real Postgres) and
 * asserts:
 *   1. POST /marketplace/checkout writes a row `payments.ts` can find via
 *      ordersTable.externalOrderId (orderKind = 'marketplace').
 *   2. POST /payments/razorpay/order successfully resolves and bills that
 *      row for the real, server-computed total — not a client-supplied
 *      amount (a tampered/lowballed `amountPaise` in the request body is
 *      ignored, exactly as it is for meal orders).
 *   3. The Razorpay gateway call it makes is the mocked
 *      `https://api.razorpay.com/v1/orders` endpoint here, so we can
 *      assert on the exact `amount` sent — the real integrity check for
 *      "not tampered".
 *
 * Run with:
 *   node --test --import tsx ./src/routes/marketplace.paymentsIntegration.test.ts
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, marketplaceItemsTable, ordersTable, usersTable } from "@workspace/db";

import marketplaceRouter from "./marketplace";
import paymentsRouter from "./payments";

const KEY_ID = "rzp_test_mkt";
const KEY_SECRET = "secret_test_mkt";

process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;

interface TestUser {
  id: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_ITEM_IDS: number[] = [];
const USER_REGISTRY = new Map<string, TestUser>();

// Captures every outbound call this test made to the (mocked) Razorpay
// order-creation endpoint, so assertions can inspect exactly what amount
// payments.ts tried to bill.
const razorpayOrderCalls: Array<{ amount: number; currency: string }> = [];
const realFetch = global.fetch;

function installRazorpayFetchMock() {
  global.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://api.razorpay.com/v1/orders") {
      const body = JSON.parse(init?.body ?? "{}");
      razorpayOrderCalls.push({ amount: body.amount, currency: body.currency });
      return new Response(
        JSON.stringify({ id: `order_mock_${randomUUID().slice(0, 8)}`, amount: body.amount, currency: body.currency }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
  app.use(marketplaceRouter);
  app.use(paymentsRouter);
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `mkt-pay-${id}@example.test`,
    firstName: "MktPayTest",
  });
  CREATED_USER_IDS.push(id);
  const u: TestUser = { id };
  USER_REGISTRY.set(id, u);
  return u;
}

async function makeItem(pricePaise: number): Promise<{ id: number }> {
  const slug = `mkt-pay-test-${randomUUID().slice(0, 8)}`;
  const [row] = await db
    .insert(marketplaceItemsTable)
    .values({
      slug,
      name: `Test Item ${slug}`,
      category: "pantry",
      pricePaise,
      stockQty: 50,
      isActive: true,
      supplierName: "Third Party Vendor",
    })
    .returning();
  CREATED_ITEM_IDS.push(row!.id);
  return { id: row!.id };
}

async function api(
  method: string,
  path: string,
  body: unknown,
  user?: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
      "idempotency-key": randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

before(async () => {
  installRazorpayFetchMock();
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  global.fetch = realFetch;
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(ordersTable)
      .where(
        and(
          inArray(ordersTable.userId, CREATED_USER_IDS),
          eq(ordersTable.orderKind, "marketplace"),
        ),
      );
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  for (const id of CREATED_ITEM_IDS) {
    await db.delete(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, id));
  }
});

test("marketplace checkout produces an ordersTable row that /payments/razorpay/order can actually bill for the real amount", async () => {
  const user = await makeUser();
  const item = await makeItem(45000); // ₹450.00 per unit
  const qty = 3;
  const expectedTotalPaise = 45000 * qty; // ₹1,350.00 — the ONLY amount that may be billed.

  const checkoutRes = await api(
    "POST",
    "/marketplace/checkout",
    { items: [{ itemId: item.id, qty }], deliveryMode: "ship" },
    user,
  );
  assert.equal(checkoutRes.status, 201);
  const order = checkoutRes.json.order;
  assert.ok(order, "checkout must return the created order");
  assert.equal(order.orderKind, "marketplace");
  assert.equal(order.totalPaise, expectedTotalPaise);
  assert.ok(order.externalOrderId, "order must carry an externalOrderId payments.ts can key on");

  // Sanity: the row payments.ts's create-order route resolves by
  // externalOrderId is really sitting in ordersTable (not some other
  // table it never reads), with the money-path fields intact.
  const [dbRow] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, order.externalOrderId));
  assert.ok(dbRow);
  assert.equal(dbRow.orderKind, "marketplace");
  assert.equal(dbRow.status, "placed");
  assert.equal(dbRow.totalPaise, expectedTotalPaise);
  assert.equal(dbRow.chargePaise, null, "marketplace orders fall back to totalPaise, per payments.ts's documented behavior");

  // The actual money-path call: this is the same request the mobile/web
  // checkout modal issues to open Razorpay checkout. Send a lowballed
  // `amountPaise` to prove tamper resistance — the server must ignore it
  // and bill the real total.
  const orderRes = await api(
    "POST",
    "/payments/razorpay/order",
    { orderId: order.externalOrderId, amountPaise: 100 },
    user,
  );
  assert.equal(orderRes.status, 200, JSON.stringify(orderRes.json));
  assert.equal(orderRes.json.amount, expectedTotalPaise, "must bill the server-computed total, not the tampered client amount");
  assert.equal(orderRes.json.keyId, KEY_ID);
  assert.ok(orderRes.json.razorpayOrderId);

  // And the outbound Razorpay order-creation call itself carried the real
  // amount — this is the actual money movement payments.ts triggers.
  assert.equal(razorpayOrderCalls.length, 1);
  assert.equal(razorpayOrderCalls[0]!.amount, expectedTotalPaise);
  assert.equal(razorpayOrderCalls[0]!.currency, "INR");

  // razorpayOrderId must now be bound on the row so verify()/the webhook
  // can reconcile the eventual capture against this exact order.
  const [afterBinding] = await db
    .select({ razorpayOrderId: ordersTable.razorpayOrderId })
    .from(ordersTable)
    .where(eq(ordersTable.id, dbRow.id));
  assert.equal(afterBinding!.razorpayOrderId, orderRes.json.razorpayOrderId);
});

test("a different user's marketplace order cannot be billed by /payments/razorpay/order (ownership check)", async () => {
  const owner = await makeUser();
  const intruder = await makeUser();
  const item = await makeItem(10000);

  const checkoutRes = await api(
    "POST",
    "/marketplace/checkout",
    { items: [{ itemId: item.id, qty: 1 }], deliveryMode: "ship" },
    owner,
  );
  assert.equal(checkoutRes.status, 201);
  const order = checkoutRes.json.order;

  const orderRes = await api(
    "POST",
    "/payments/razorpay/order",
    { orderId: order.externalOrderId },
    intruder,
  );
  assert.equal(orderRes.status, 403);
});
