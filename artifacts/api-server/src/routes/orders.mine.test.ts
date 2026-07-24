/**
 * Integration tests locking GET /orders/mine (orders.ts) — the storefront's
 * order-history + reorder feed:
 *
 *   - 401 unauthenticated, before any DB read.
 *   - Returns ONLY the caller's own meal orders, newest first — another
 *     user's rows and the caller's marketplace rows never appear.
 *   - The persisted line items round-trip as {id,name,qty,price} — the
 *     reorder seed the storefront's ReorderButton consumes (CUJ-09). A
 *     response without `items` would silently hide Reorder in the UI, so the
 *     field's presence is pinned here at the wire level.
 *
 * Harness mirrors refunds.test.ts: test express app, per-request auth stub
 * from an x-test-user-id header, req.log stub, http server on port 0, direct
 * db seeding with after() cleanup. Needs DATABASE_URL (CI: money-integration
 * job's Postgres service).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/orders.mine.test.ts
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
import { inArray } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";

import ordersRouter from "./orders";

const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `TAN-MINE-${name}-${RUN}`;

const USER_REGISTRY = new Map<string, { id: string }>();

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
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(ordersRouter);
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
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_ORDER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(label: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `orders-mine-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return user;
}

interface SeedOrder {
  userId: string;
  externalOrderId: string;
  orderKind?: string;
  items?: { id: number; name: string; qty: number; price: number }[];
  createdAt?: Date;
}

async function seedOrder(fields: SeedOrder): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: fields.userId,
      externalOrderId: fields.externalOrderId,
      status: "delivered",
      totalPaise: 41800,
      orderKind: fields.orderKind ?? "meal",
      items: fields.items ?? [],
      ...(fields.createdAt ? { createdAt: fields.createdAt } : {}),
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function getMine(userId?: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}/orders/mine`, {
    headers: userId ? { "x-test-user-id": userId } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------

const LINES = [
  { id: 16, name: "Avocado Toast", qty: 2, price: 24000 },
  { id: 31, name: "Quinoa Khichdi", qty: 1, price: 17800 },
];

const userA = await makeUser("alice");
const userB = await makeUser("bob");

// A: older + newer meal orders, plus a marketplace order that must not leak in.
await seedOrder({
  userId: userA.id,
  externalOrderId: ext("a-old"),
  items: [{ id: 31, name: "Quinoa Khichdi", qty: 1, price: 17800 }],
  createdAt: new Date("2026-07-20T10:00:00Z"),
});
await seedOrder({
  userId: userA.id,
  externalOrderId: ext("a-new"),
  items: LINES,
  createdAt: new Date("2026-07-22T10:00:00Z"),
});
await seedOrder({
  userId: userA.id,
  externalOrderId: ext("a-market"),
  orderKind: "marketplace",
  createdAt: new Date("2026-07-23T10:00:00Z"),
});
// B: a meal order that must never appear in A's feed.
await seedOrder({
  userId: userB.id,
  externalOrderId: ext("b-meal"),
  items: [{ id: 16, name: "Avocado Toast", qty: 1, price: 24000 }],
});

test("unauthenticated → 401, no data", async () => {
  const r = await getMine();
  assert.equal(r.status, 401);
  assert.equal(r.body?.error, "unauthorized");
});

test("returns only the caller's meal orders, newest first", async () => {
  const r = await getMine(userA.id);
  assert.equal(r.status, 200);
  const mine = r.body.orders.filter((o: { externalOrderId: string }) =>
    o.externalOrderId.includes(RUN),
  );
  assert.deepEqual(
    mine.map((o: { externalOrderId: string }) => o.externalOrderId),
    [ext("a-new"), ext("a-old")],
    "A sees exactly her two meal orders, newest first — no marketplace row, none of B's",
  );
});

test("line items round-trip as {id,name,qty,price} — the reorder seed", async () => {
  const r = await getMine(userA.id);
  const newest = r.body.orders.find(
    (o: { externalOrderId: string }) => o.externalOrderId === ext("a-new"),
  );
  assert.ok(newest, "seeded order present");
  assert.deepEqual(newest.items, LINES);
});

test("another caller never sees A's orders", async () => {
  const r = await getMine(userB.id);
  assert.equal(r.status, 200);
  const leaked = r.body.orders.filter((o: { externalOrderId: string }) =>
    o.externalOrderId.startsWith(`TAN-MINE-a-`),
  );
  assert.deepEqual(leaked, []);
});
