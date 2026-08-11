/**
 * GET /orders/:externalOrderId/status — P0-3 timing contract.
 *
 * Before this fix, every order got the same derived "25 minus minutes since
 * createdAt" countdown, including scheduled subscription deliveries days out.
 * This suite pins the three-way split: an on-demand order still gets the
 * countdown; a scheduled delivery (linked via subscription_deliveries.order_id)
 * gets its own confirmed date/window and never a countdown; a subscription
 * order whose delivery link hasn't landed gets a controlled pending state
 * instead of guessing. See docs/audit/P0-3-SCHEDULE-NOT-COUNTDOWN.md.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.orderStatus.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express } from "express";
import { inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
} from "@workspace/db";

import checkoutRouter from "./checkout";

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_ORDER_IDS: number[] = [];
const CREATED_SUB_IDS: number[] = [];

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(checkoutRouter);
  return app;
}

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `order-status-${id}@example.test`,
    firstName: "Order",
    lastName: "Status",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("on-demand order: unchanged 25-minute countdown, no schedule fields", async () => {
  const userId = await makeUser();
  const externalOrderId = `alc-${randomUUID()}`;
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId,
      status: "preparing",
      totalPaise: 50000,
      items: [{ id: 1, name: "Test dish", qty: 1, price: 50000 }],
    })
    .returning();
  CREATED_ORDER_IDS.push(order!.id);

  const res = await fetch(`${baseUrl}/orders/${externalOrderId}/status`);
  const body = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(body.timing, "on_demand");
  assert.equal(typeof body.etaMinutes, "number");
  assert.ok(body.etaMinutes <= 25 && body.etaMinutes >= 0, `etaMinutes out of range: ${body.etaMinutes}`);
  assert.equal(body.scheduledFor, null);
  assert.equal(body.deliveryWindow, null);
});

test("scheduled subscription delivery: confirmed date/window, never a countdown", async () => {
  const userId = await makeUser();
  const externalOrderId = `sub-${randomUUID()}`;
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId,
      status: "preparing",
      totalPaise: 119900,
      items: [],
    })
    .returning();
  CREATED_ORDER_IDS.push(order!.id);

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: "weekly",
      mealsPerDelivery: 6,
      deliveryWindow: "12:00-14:00",
      startDate: new Date(),
      nextDeliveryAt: new Date(),
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  // 3 days out — nowhere near the 25-minute on-demand SLA window, so if the
  // old countdown formula were still in play this would visibly show 0 min.
  const scheduledFor = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  await db.insert(subscriptionDeliveriesTable).values({
    subscriptionId: sub!.id,
    scheduledFor,
    deliveryWindow: "12:00-14:00",
    orderId: order!.id,
  });

  const res = await fetch(`${baseUrl}/orders/${externalOrderId}/status`);
  const body = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(body.timing, "scheduled");
  assert.equal(body.etaMinutes, null);
  assert.equal(body.scheduledFor, scheduledFor.toISOString());
  assert.equal(body.deliveryWindow, "12:00-14:00");
});

test("subscription order with no linked delivery yet: controlled pending, not a guessed countdown", async () => {
  const userId = await makeUser();
  const externalOrderId = `sub-${randomUUID()}-unlinked`;
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId,
      status: "placed",
      totalPaise: 119900,
      items: [],
    })
    .returning();
  CREATED_ORDER_IDS.push(order!.id);

  const res = await fetch(`${baseUrl}/orders/${externalOrderId}/status`);
  const body = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(body.timing, "pending");
  assert.equal(body.etaMinutes, null);
  assert.equal(body.scheduledFor, null);
  assert.equal(body.deliveryWindow, null);
});

test("unknown order id: 404, as before", async () => {
  const res = await fetch(`${baseUrl}/orders/${randomUUID()}/status`);
  assert.equal(res.status, 404);
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_SUB_IDS.length > 0) {
    await db
      .delete(subscriptionDeliveriesTable)
      .where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, CREATED_SUB_IDS));
  }
  if (CREATED_ORDER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
