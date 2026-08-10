/**
 * D-22 / A3 — proves the money-safety half of "multi-tap fired 2–3 identical
 * POST /api/orders" (audit finding): two concurrent POST /orders requests
 * carrying the SAME Idempotency-Key create exactly one order.
 *
 * This is deliberately NOT a change to checkout.ts — re-verifying the
 * runbook's anchor (Bible Law 9.5) found the server side of this already
 * done: `idempotencyMiddleware` is mounted on `POST /api/orders` in app.ts,
 * generically tested in middlewares/idempotency.test.ts (including its own
 * "two-in-flight race" case). What was missing was proof AT THIS ROUTE,
 * wired the same way production wires it (middleware BEFORE the router, the
 * same order app.ts uses) — the existing checkout.*.test.ts files mount
 * `checkoutRouter` alone and never touch idempotency at all, so nothing
 * previously exercised this specific combination. The client-side fix (a
 * synchronous double-tap guard + stable button dimensions) is the real A3
 * diff — see components/checkout/AlacarteDetails.tsx.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.doubletap.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, idempotencyKeysTable } from "@workspace/db";
import { idempotencyMiddleware } from "../middlewares/idempotency";
import checkoutRouter from "./checkout";

let server: http.Server;
let baseUrl = "";
const CREATED_EXTERNAL_IDS: string[] = [];

// Same mount order as app.ts: idempotencyMiddleware on POST /orders BEFORE
// the router that handles it. Mounting checkoutRouter alone (the existing
// checkout.*.test.ts pattern) would silently skip the middleware and prove
// nothing about the real request path.
function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: Record<string, (...a: unknown[]) => void> }).log = {
      error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
  app.post("/orders", idempotencyMiddleware);
  app.use(checkoutRouter);
  return app;
}

const SANDWICH_DISH_ID = 121; // real catalog dish — see checkout.customizations.test.ts

function orderBody(externalOrderId: string) {
  return {
    externalOrderId,
    items: [{ dishId: SANDWICH_DISH_ID, qty: 1 }],
    phone: "9999999999",
    address: { line1: "1 Test Rd", city: "Noida", pincode: "201301" }, // serviceable
    consent: { accepted: true, policyVersion: "dpdp-v1" },
    allergenAck: true, // the sandwich fixture carries declared allergens
  };
}

async function placeOrder(externalOrderId: string) {
  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": externalOrderId },
    body: JSON.stringify(orderBody(externalOrderId)),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("two concurrent taps with the same Idempotency-Key create exactly one order", async () => {
  const externalOrderId = `ord-doubletap-${randomUUID()}`;
  CREATED_EXTERNAL_IDS.push(externalOrderId);

  // The exact race a fast double-tap produces: two requests in flight at
  // once, same key, same body — matching what AlacarteCheckout's
  // idempotencyKey ref actually sends on a second tap that beats React's
  // re-render (see AlacarteDetails.tsx's submitLockRef comment).
  const [a, b] = await Promise.all([placeOrder(externalOrderId), placeOrder(externalOrderId)]);

  assert.equal(a.status, 201, JSON.stringify(a.json));
  assert.equal(b.status, 201, JSON.stringify(b.json));
  // Same server order — one was served fresh, the other replayed the exact
  // same response (Idempotent-Replay), never a second insert.
  assert.equal(a.json.serverOrderId, b.json.serverOrderId);
  assert.equal(a.json.orderId, b.json.orderId);

  const rows = await db.select().from(ordersTable).where(eq(ordersTable.externalOrderId, externalOrderId));
  assert.equal(rows.length, 1, "exactly one order row for a doubled-up submit — never two");
});

test("three near-simultaneous taps still create exactly one order", async () => {
  // The audit specifically observed 2-3 identical requests, not just 2.
  const externalOrderId = `ord-doubletap-${randomUUID()}`;
  CREATED_EXTERNAL_IDS.push(externalOrderId);

  const results = await Promise.all([
    placeOrder(externalOrderId),
    placeOrder(externalOrderId),
    placeOrder(externalOrderId),
  ]);

  for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.json));
  const serverOrderIds = new Set(results.map((r) => r.json.serverOrderId));
  assert.equal(serverOrderIds.size, 1, "all three taps must resolve to the SAME order");

  const rows = await db.select().from(ordersTable).where(eq(ordersTable.externalOrderId, externalOrderId));
  assert.equal(rows.length, 1);
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_EXTERNAL_IDS.length > 0) {
    for (const id of CREATED_EXTERNAL_IDS) {
      await db.delete(ordersTable).where(eq(ordersTable.externalOrderId, id));
      await db.delete(idempotencyKeysTable).where(eq(idempotencyKeysTable.key, id));
    }
  }
});
