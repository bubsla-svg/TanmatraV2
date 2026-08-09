/**
 * Paid-fulfilment invariant on the two ops routes that consume REAL inventory
 * (lib/paidGate.ts, docs/MONEY-PATH-VERIFICATION.md §5):
 *
 *   POST /api/ops/wms/route-fulfillment   — FEFO stock deduction + KDS bypass
 *   POST /api/ops/kds/orders/:id/explode-bom — BOM ingredient deduction
 *
 * Both take an order id from the request rather than from a board query, so
 * the KDS board's status filter never protects them: before the guard, any
 * authenticated caller (or an ops-agent tool given a stale id) could deduct
 * stock against an UNPAID (placed) or terminal order. The predicate is
 * paid-LIVE, not assignable — packing and cooking legitimately continue after
 * a rider is attached — so rider_assigned/out_for_delivery pass, while
 * placed/terminal/billed/unknown are refused with 409 before any engine runs.
 *
 * Unauthenticated access for every /ops route is pinned by ops.gate.test.ts;
 * this file only exercises authenticated behaviour. Harness mirrors
 * ops.kds.test.ts. Needs DATABASE_URL (CI: money-integration's Postgres).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/ops.paidGate.test.ts
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

import opsRouter from "./ops";

const ADMIN_TOKEN = `test-ops-token-paidgate-${randomUUID().slice(0, 8)}`;
const RUN = randomUUID().slice(0, 8);

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      isAuthenticated: () => boolean;
      log: Record<string, (...a: unknown[]) => void>;
    };
    r.isAuthenticated = () => false;
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
  app.use("/api/ops", opsRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_ORDER_IDS: number[] = [];
const CREATED_USER_IDS: string[] = [];

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  if (CREATED_ORDER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  server.close();
});

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `paidgate-${id}@test.local`,
    firstName: "PaidGate",
    lastName: "Test",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

async function seedOrder(userId: string, status: string): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId,
      status,
      totalPaise: 42000,
      items: [{ id: 31, name: "Moong Khichdi", qty: 2, price: 21000 }],
      fulfillmentType: "delivery",
      pincode: "560001",
      addressLine: "12 Test Lane",
      city: "Bengaluru",
      phone: "+919000000001",
      priority: "routine",
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function statusOf(id: number): Promise<string> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!.status;
}

async function postJson(
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/ops${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

const wmsBody = (orderId: number) => ({
  orderId,
  externalOrderId: `TAN-PG-${RUN}-${orderId}`,
  // Empty basket on purpose: past the gate it routes zero lines and deducts
  // nothing, so the control below can prove gate-passage without needing a
  // seeded inventory fixture.
  items: [],
});

test("route-fulfillment refuses every non-paid-live status with 409 and writes nothing", async () => {
  const userId = await makeUser();
  for (const status of ["placed", "failed", "cancelled", "delivered", "billed"]) {
    const orderId = await seedOrder(userId, status);
    const res = await postJson("/wms/route-fulfillment", wmsBody(orderId));
    assert.equal(res.status, 409, `a ${status} order was routed for fulfilment`);
    assert.deepEqual(res.json, { error: "order not in a fulfillable status" });
    assert.equal(await statusOf(orderId), status, `a ${status} order had its status moved`);
  }
});

test("route-fulfillment answers 404, not 409, for an order that does not exist", async () => {
  // 404 vs 409 matters to a caller deciding between "retry after payment"
  // and "drop the id" — the two must not blur.
  const res = await postJson("/wms/route-fulfillment", wmsBody(2_000_000_000));
  assert.equal(res.status, 404);
  assert.deepEqual(res.json, { error: "order not found" });
});

test("route-fulfillment still routes a PAID live order — the matched pair", async () => {
  const userId = await makeUser();
  for (const status of ["preparing", "rider_assigned"]) {
    const orderId = await seedOrder(userId, status);
    const res = await postJson("/wms/route-fulfillment", wmsBody(orderId));
    assert.equal(res.status, 200, `a paid ${status} order was refused: ${JSON.stringify(res.json)}`);
    assert.equal(res.json["ok"], true);
  }
});

test("explode-bom refuses an UNPAID (placed) order with 409 before any deduction", async () => {
  const userId = await makeUser();
  const orderId = await seedOrder(userId, "placed");
  const res = await postJson(`/kds/orders/${orderId}/explode-bom`, { items: [] });
  assert.equal(res.status, 409, "BOM explosion ran for an unpaid order");
  assert.deepEqual(res.json, { error: "order not in a fulfillable status" });
  assert.equal(await statusOf(orderId), "placed");
});

test("explode-bom answers 404 for missing and non-numeric order ids", async () => {
  const missing = await postJson(`/kds/orders/2000000000/explode-bom`, { items: [] });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.json, { error: "order not found" });

  // parseInt("abc") is NaN; unguarded it reaches Postgres as an invalid
  // integer literal and 500s.
  const nan = await postJson(`/kds/orders/not-a-number/explode-bom`, { items: [] });
  assert.equal(nan.status, 404);
  assert.deepEqual(nan.json, { error: "order not found" });
});

test("explode-bom still runs for a PAID live order — the matched pair", async () => {
  const userId = await makeUser();
  const orderId = await seedOrder(userId, "preparing");
  const res = await postJson(`/kds/orders/${orderId}/explode-bom`, { items: [] });
  assert.equal(res.status, 200, `a paid preparing order was refused: ${JSON.stringify(res.json)}`);
  assert.equal(res.json["ok"], true);
  assert.deepEqual(res.json["deductions"], []);
});
