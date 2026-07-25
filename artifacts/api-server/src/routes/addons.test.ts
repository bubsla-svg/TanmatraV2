/**
 * Integration tests locking POST /addons/attach (routes/addons.ts) — the
 * bolt-on add-on path, which had ZERO CI coverage while it was writing to a
 * money-authority column.
 *
 * What this pins, and why each one is a money invariant rather than a nicety:
 *
 *   - attach NEVER moves orders.total_paise or orders.charge_paise. Those are
 *     written once by finalizeOrder and are the only numbers the payment path
 *     bills and reconciles against. The removed code did
 *       set({ totalPaise: order.totalPaise + totalAddedPaise })
 *     which made isCaptureAmountReconciled reject a LEGITIMATE capture on rows
 *     whose charge_paise is null (guest/legacy), because the expected total
 *     moved after the Razorpay order was created — and, once the refund-cap
 *     work lands, manufactured refund headroom for money that never arrived.
 *   - the 201 says `billed: false` at the wire level, so no client can mistake
 *     a successful attach for a charge.
 *   - a closed order (cancelled/refunded/failed/billed/delivered) refuses with
 *     409 and echoes the status, and writes nothing.
 *   - another user's order is 404 and writes nothing. The old UPDATE's WHERE
 *     dropped the userId predicate the SELECT had.
 *   - concurrent attaches to the same order both land in full. The old
 *     read-modify-write lost one of them.
 *
 * Harness mirrors orders.mine.test.ts: test express app, per-request auth stub
 * from an x-test-user-id header, req.log stub, http server on port 0, direct db
 * seeding with after() cleanup. Needs DATABASE_URL (CI: money-integration job's
 * Postgres service).
 *
 * Run with:
 *   node --test --test-force-exit --import tsx ./src/routes/addons.test.ts
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
import {
  db,
  addonsTable,
  orderAddonsTable,
  ordersTable,
  usersTable,
  type OrderStatus,
} from "@workspace/db";

import addonsRouter from "./addons";

const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `TAN-ADDON-${name}-${RUN}`;

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
  app.use(addonsRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_ORDER_IDS: number[] = [];
const CREATED_USER_IDS: string[] = [];
const CREATED_ADDON_IDS: number[] = [];

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // order_addons cascades off orders, but addons does NOT cascade off
  // order_addons — so the join rows must go before the catalogue rows.
  if (CREATED_ORDER_IDS.length > 0) {
    await db
      .delete(orderAddonsTable)
      .where(inArray(orderAddonsTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_ADDON_IDS.length > 0) {
    await db.delete(addonsTable).where(inArray(addonsTable.id, CREATED_ADDON_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(label: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `addons-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return user;
}

/** Run-scoped catalogue rows so this suite never depends on SEED_ADDONS. */
async function makeAddon(
  label: string,
  pricePaise: number,
  premiumOnly = false,
): Promise<number> {
  const [row] = await db
    .insert(addonsTable)
    .values({
      slug: `addon-${label}-${RUN}`,
      name: `Test ${label}`,
      category: "snack",
      pricePaise,
      premiumOnly,
      recommendedFor: [],
      macros: null,
      isActive: true,
    })
    .returning({ id: addonsTable.id });
  CREATED_ADDON_IDS.push(row!.id);
  return row!.id;
}

const SEED_TOTAL_PAISE = 41800;
const SEED_CHARGE_PAISE = 46990;

async function seedOrder(
  userId: string,
  label: string,
  status: OrderStatus = "placed",
  chargePaise: number | null = SEED_CHARGE_PAISE,
): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId: ext(label),
      status,
      totalPaise: SEED_TOTAL_PAISE,
      chargePaise,
      orderKind: "meal",
      items: [],
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function attach(
  orderId: number,
  items: Array<{ addonId: number; qty: number }>,
  userId?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}/addons/attach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-test-user-id": userId } : {}),
    },
    body: JSON.stringify({ orderId, items }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function readMoney(
  orderId: number,
): Promise<{ totalPaise: number; chargePaise: number | null }> {
  const [row] = await db
    .select({
      totalPaise: ordersTable.totalPaise,
      chargePaise: ordersTable.chargePaise,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  return row!;
}

async function countJoinRows(orderId: number): Promise<number> {
  const rows = await db
    .select({ id: orderAddonsTable.id })
    .from(orderAddonsTable)
    .where(eq(orderAddonsTable.orderId, orderId));
  return rows.length;
}

// ---------------------------------------------------------------------------

const alice = await makeUser("alice");
const bob = await makeUser("bob");
const juiceId = await makeAddon("juice", 14900);
const barId = await makeAddon("bar", 12900);
const premiumId = await makeAddon("collagen", 49900, true);

test("attach records the add-ons but moves NEITHER money column, and says billed:false", async () => {
  const orderId = await seedOrder(alice.id, "money");
  const before = await readMoney(orderId);

  const r = await attach(orderId, [{ addonId: juiceId, qty: 2 }], alice.id);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.addons.length, 1);
  assert.equal(r.body.addons[0].qty, 2);
  assert.equal(r.body.addons[0].unitPricePaise, 14900);
  assert.equal(r.body.addedPaise, 29800, "addedPaise is what they WOULD cost");
  assert.equal(
    r.body.billed,
    false,
    "the wire must state that nothing was charged for these",
  );

  const after = await readMoney(orderId);
  assert.equal(
    after.totalPaise,
    before.totalPaise,
    "total_paise is finalizeOrder's to write — attach must not touch it",
  );
  assert.equal(
    after.chargePaise,
    before.chargePaise,
    "charge_paise is THE authoritative amount to charge — attach must not touch it",
  );
});

test("a null charge_paise order (guest/legacy) is equally untouched — the reconcile false-mismatch case", async () => {
  const orderId = await seedOrder(alice.id, "legacy", "preparing", null);
  const r = await attach(orderId, [{ addonId: barId, qty: 1 }], alice.id);
  assert.equal(r.status, 201, JSON.stringify(r.body));

  const after = await readMoney(orderId);
  assert.equal(after.chargePaise, null);
  assert.equal(
    after.totalPaise,
    SEED_TOTAL_PAISE,
    "on a null-charge_paise row total_paise IS the reconcile basis — moving it would " +
      "make isCaptureAmountReconciled refuse a legitimate capture",
  );
});

for (const status of ["cancelled", "refunded", "failed", "billed", "delivered"] as const) {
  test(`a ${status} order refuses with 409, echoes the status, and writes nothing`, async () => {
    const orderId = await seedOrder(alice.id, `closed-${status}`, status);
    const r = await attach(orderId, [{ addonId: juiceId, qty: 1 }], alice.id);
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.status, status, "the 409 echoes the blocking status");
    assert.equal(await countJoinRows(orderId), 0, "no add-on row was written");
    const after = await readMoney(orderId);
    assert.equal(after.totalPaise, SEED_TOTAL_PAISE);
  });
}

test("every live status still accepts an attach", async () => {
  const live = [
    "placed",
    "preparing",
    "ready",
    "rider_assigned",
    "out_for_delivery",
  ] as const;
  for (const status of live) {
    const orderId = await seedOrder(alice.id, `live-${status}`, status);
    const r = await attach(orderId, [{ addonId: barId, qty: 1 }], alice.id);
    assert.equal(r.status, 201, `${status} must still be attachable: ${JSON.stringify(r.body)}`);
  }
});

test("another user's order is 404 and writes nothing — the WHERE that used to drop userId", async () => {
  const orderId = await seedOrder(alice.id, "cross-user");
  const r = await attach(orderId, [{ addonId: juiceId, qty: 1 }], bob.id);
  assert.equal(r.status, 404, JSON.stringify(r.body));
  assert.equal(await countJoinRows(orderId), 0);
  const after = await readMoney(orderId);
  assert.equal(after.totalPaise, SEED_TOTAL_PAISE);
  assert.equal(after.chargePaise, SEED_CHARGE_PAISE);
});

test("unauthenticated is 401 before any DB read", async () => {
  const orderId = await seedOrder(alice.id, "anon");
  const r = await attach(orderId, [{ addonId: juiceId, qty: 1 }]);
  assert.equal(r.status, 401);
  assert.equal(r.body?.error, "unauthorized");
  assert.equal(await countJoinRows(orderId), 0);
});

test("a premium-only add-on is 403 for a non-member and writes nothing", async () => {
  const orderId = await seedOrder(alice.id, "premium-gate");
  const r = await attach(orderId, [{ addonId: premiumId, qty: 1 }], alice.id);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.equal(await countJoinRows(orderId), 0);
});

test("concurrent attaches to one order both land in full — the lost-update case", async () => {
  const orderId = await seedOrder(alice.id, "concurrent");
  const [a, b] = await Promise.all([
    attach(orderId, [{ addonId: juiceId, qty: 1 }], alice.id),
    attach(orderId, [{ addonId: barId, qty: 3 }], alice.id),
  ]);
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.equal(
    await countJoinRows(orderId),
    2,
    "both attaches persisted — neither overwrote the other",
  );
  const after = await readMoney(orderId);
  assert.equal(
    after.totalPaise,
    SEED_TOTAL_PAISE,
    "and the old read-modify-write can no longer lose an increment, because " +
      "there is no increment at all",
  );
});

test("an unknown add-on id is 400 (no valid addons) and writes nothing", async () => {
  const orderId = await seedOrder(alice.id, "unknown-addon");
  const r = await attach(orderId, [{ addonId: 2_000_000_000, qty: 1 }], alice.id);
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(await countJoinRows(orderId), 0);
});
