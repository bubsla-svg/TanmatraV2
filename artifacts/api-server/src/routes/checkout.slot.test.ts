/**
 * POST /orders with a chosen delivery window (T-08).
 *
 * The window is an id from GET /delivery/slots; the server reserves the seat
 * alongside the order and the status route reports it as `scheduled` with the
 * booked window — never a fabricated countdown. A window the server never
 * offered is refused before any row is written.
 *
 * Harness mirrors checkout.quote.test.ts. Needs DATABASE_URL.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.slot.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq, inArray, like, sql } from "drizzle-orm";
import { db, deliverySlotsTable, ordersTable, slotReservationsTable } from "@workspace/db";
import { TEST_DISHES } from "../test-fixtures/dishes.js";

import checkoutRouter from "./checkout";
import fulfillmentRouter from "./fulfillment";

const RUN = randomUUID().slice(0, 8);
const EXT_PREFIX = `slot-${RUN}-`;

const CHEAP_DISH = TEST_DISHES.find((d) => d.slug === "test-smoothie-bowl");
assert.ok(CHEAP_DISH, "test-smoothie-bowl fixture dish missing from TEST_DISHES");

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { isAuthenticated: () => boolean; log: Record<string, (...a: unknown[]) => void> };
    r.isAuthenticated = () => false;
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(fulfillmentRouter);
  app.use(checkoutRouter);
  return app;
}

async function ensureServer(): Promise<void> {
  if (baseUrl) return;
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  await ensureServer();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function orderBody(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    externalOrderId: `${EXT_PREFIX}${randomUUID().slice(0, 12)}`,
    items: [{ dishId: CHEAP_DISH!.id, qty: 1 }],
    phone: "+919999900002",
    address: { line1: "Slot lane 1", city: "Noida", pincode: "201301" },
    consent: { accepted: true, policyVersion: "dpdp-2023-v1" },
    allergenAck: true,
    ...extra,
  };
}

after(async () => {
  const rows = await db
    .select({ id: ordersTable.id, slotId: ordersTable.deliverySlotId })
    .from(ordersTable)
    .where(like(ordersTable.externalOrderId, `${EXT_PREFIX}%`));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(slotReservationsTable).where(inArray(slotReservationsTable.orderId, ids));
    for (const r of rows) {
      if (r.slotId) {
        await db
          .update(deliverySlotsTable)
          .set({ reservedCount: sql`greatest(0, ${deliverySlotsTable.reservedCount} - 1)` })
          .where(eq(deliverySlotsTable.id, r.slotId));
      }
    }
    await db.delete(ordersTable).where(inArray(ordersTable.id, ids));
  }
  await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
});

test("an open window from GET /delivery/slots books the order into that window", async () => {
  const listed = await call("GET", "/delivery/slots?zone=default");
  assert.equal(listed.status, 200);
  const slots = listed.json["slots"] as Array<{ id: number; full: boolean; startsAt: string }>;
  const open = slots.find((s) => !s.full);
  assert.ok(open, "the seeded zone should offer at least one open window");

  const before = (await db.select({ n: deliverySlotsTable.reservedCount }).from(deliverySlotsTable).where(eq(deliverySlotsTable.id, open.id)))[0]!.n;

  const created = await call("POST", "/orders", orderBody({ deliverySlotId: open.id, deliveryInstructions: "Ring twice" }));
  assert.equal(created.status, 201, JSON.stringify(created.json));
  assert.equal(created.json["scheduledFor"], open.startsAt);
  assert.match(String(created.json["deliveryWindow"]), /^\d{2}:\d{2}–\d{2}:\d{2}$/);

  const after_ = (await db.select({ n: deliverySlotsTable.reservedCount }).from(deliverySlotsTable).where(eq(deliverySlotsTable.id, open.id)))[0]!.n;
  assert.equal(after_, before + 1, "the seat is reserved with the order");

  const status = await call("GET", `/orders/${created.json["orderId"]}/status`);
  assert.equal(status.status, 200);
  assert.equal(status.json["timing"], "scheduled");
  assert.equal(status.json["scheduledFor"], open.startsAt);
  assert.equal(status.json["etaMinutes"], null, "a booked window is never a countdown");

  const [row] = await db
    .select({ instructions: ordersTable.deliveryInstructions, slotId: ordersTable.deliverySlotId })
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, String(created.json["orderId"])));
  assert.equal(row?.instructions, "Ring twice");
  assert.equal(row?.slotId, open.id);
});

test("a window the server never offered is refused before any order exists", async () => {
  const body = orderBody({ deliverySlotId: 2_147_000_000 });
  const r = await call("POST", "/orders", body);
  assert.equal(r.status, 422);
  assert.equal(r.json["code"], "slot_not_found");
  const rows = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.externalOrderId, String(body["externalOrderId"])));
  assert.equal(rows.length, 0, "no row is written for a refused window");
});

test("an order without a window still places, and still reads as on-demand", async () => {
  const created = await call("POST", "/orders", orderBody({}));
  assert.equal(created.status, 201, JSON.stringify(created.json));
  assert.equal("scheduledFor" in created.json, false);
  const status = await call("GET", `/orders/${created.json["orderId"]}/status`);
  assert.equal(status.json["timing"], "on_demand");
});
