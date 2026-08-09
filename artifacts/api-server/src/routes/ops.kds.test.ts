/**
 * Contract tests for the kitchen display routes in ops.ts:
 *
 *   GET  /api/ops/kds/orders
 *   POST /api/ops/kds/orders/:id/ready
 *
 * These shipped with no server-side test of any kind. petpooja.test.ts
 * restates the KDS status allowlist as a local constant, which is useful but
 * never touches the route — so the two things the /kitchen board actually
 * leans on were asserted nowhere:
 *
 *   1. The board is OUR board. `own_app` + `meal` only. An aggregator ticket
 *      appearing on the kitchen screen is not a cosmetic bug: Zomato's and
 *      Swiggy's own tablets already drive those orders through Petpooja, so a
 *      duplicated ticket gets cooked twice, and marking it "ready" here moves
 *      a row whose lifecycle we do not own.
 *   2. The 404 `order_not_on_board` body. The board's optimistic Ready button
 *      removes the ticket, fires, and then decides from the status code
 *      whether to restore it (see lib/kds.ts readyOutcome). 404 is the one
 *      outcome that means "someone else already advanced this — do NOT put it
 *      back". If this route ever answered 200 or 500 for an off-board id, the
 *      board would either silently lose a real ticket or resurrect a cooked
 *      one.
 *
 * Every channel/kind exclusion below is a MATCHED PAIR: an identical own_app
 * meal row is seeded beside it and asserted present in the same response. A
 * board that is broken for everything would pass the absence half on its own;
 * the pair is what makes a pass attributable to the predicate.
 *
 * Absence/presence is asserted against this run's own fixture ids, never
 * against the board's total size — the query has no user filter, so rows from
 * other suites sharing the database are legitimately on the board too.
 *
 * Harness mirrors orders.mine.test.ts: test express app, x-admin-token for the
 * ops gate, req.log + isAuthenticated stubs (the gate calls isAuthenticated on
 * the refusal path, so an unstubbed app would 500 where it should 403), http
 * server on port 0, direct db seeding with after() cleanup. Needs DATABASE_URL
 * (CI: money-integration job's Postgres service).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/ops.kds.test.ts
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
import type { OrderChannel } from "@workspace/db/schema";

import opsRouter from "./ops";

const ADMIN_TOKEN = `test-ops-token-kds-${randomUUID().slice(0, 8)}`;
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
  // routes/index.ts mounts this router at "/ops" inside the "/api" router.
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
    email: `kds-${id}@test.local`,
    firstName: "Kds",
    lastName: "Test",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

interface SeedOpts {
  userId: string;
  channel?: OrderChannel;
  kind?: "meal" | "marketplace";
  status?: string;
  createdAt?: Date;
  externalOrderId?: string;
}

async function seedOrder(opts: SeedOpts): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: opts.userId,
      // Left off where the caller wants the column default, so the default
      // itself stays exercised rather than papered over by the fixture.
      ...(opts.channel ? { orderChannel: opts.channel } : {}),
      ...(opts.kind ? { orderKind: opts.kind } : {}),
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      ...(opts.externalOrderId ? { externalOrderId: opts.externalOrderId } : {}),
      // Default is "preparing" — the PAID arrival state. "placed" is unpaid
      // (paid-fulfilment invariant, lib/paidGate.ts) and must be seeded
      // explicitly by the tests that prove its exclusion.
      status: opts.status ?? "preparing",
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

interface BoardRow {
  id: number;
  externalOrderId: string | null;
  status: string;
  items: unknown;
  createdAt: string;
}

async function getBoard(opts: { auth: boolean }): Promise<{
  status: number;
  rows: BoardRow[];
  raw: unknown;
}> {
  const res = await fetch(`${baseUrl}/api/ops/kds/orders`, {
    headers: opts.auth ? { "x-admin-token": ADMIN_TOKEN } : {},
  });
  const raw = (await res.json()) as { orders?: BoardRow[] };
  return { status: res.status, rows: raw.orders ?? [], raw };
}

async function postReady(
  id: number | string,
  opts: { auth: boolean },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/ops/kds/orders/${id}/ready`, {
    method: "POST",
    headers: opts.auth ? { "x-admin-token": ADMIN_TOKEN } : {},
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function statusOf(id: number): Promise<string> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!.status;
}

process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

test("GET /kds/orders without ops credentials is refused (403)", async () => {
  const res = await getBoard({ auth: false });
  assert.equal(res.status, 403);
  assert.deepEqual(res.raw, { error: "ops scope required" });
});

test("GET /kds/orders with a wrong token is refused, not treated as valid", async () => {
  const res = await fetch(`${baseUrl}/api/ops/kds/orders`, {
    headers: { "x-admin-token": "not-the-token" },
  });
  assert.equal(res.status, 403);
});

test("POST /kds/orders/:id/ready without ops credentials is refused (403) and advances nothing", async () => {
  const userId = await makeUser();
  const orderId = await seedOrder({ userId });

  const res = await postReady(orderId, { auth: false });
  assert.equal(res.status, 403);
  assert.equal(res.body["error"], "ops scope required");
  // The gate must refuse before the UPDATE, not after it.
  assert.equal(await statusOf(orderId), "preparing");
});

test("the board carries own-app meal tickets and excludes every other channel", async () => {
  const userId = await makeUser();

  const placedUnpaid = await seedOrder({ userId, status: "placed" });
  const preparing = await seedOrder({ userId, status: "preparing" });

  const excluded: Array<{ label: string; id: number }> = [];
  for (const channel of ["zomato", "swiggy", "pos", "other"] as const) {
    excluded.push({
      label: channel,
      id: await seedOrder({ userId, channel, status: "placed" }),
    });
  }

  const res = await getBoard({ auth: true });
  assert.equal(res.status, 200);
  const ids = new Set(res.rows.map((r) => r.id));

  // Presence half: the paid own_app ticket.
  assert.ok(ids.has(preparing), "a preparing own_app meal ticket is missing from the board");
  // Absence half #1 — the paid-fulfilment invariant: an own_app "placed" row
  // is UNPAID (the customer may have abandoned the Razorpay modal) and must
  // never appear as a preparation ticket.
  assert.ok(
    !ids.has(placedUnpaid),
    "an UNPAID (placed) own_app order reached the kitchen board — the paid-fulfilment invariant is broken",
  );

  // Absence half: identical rows, one column different.
  for (const row of excluded) {
    assert.ok(
      !ids.has(row.id),
      `a ${row.label} ticket reached the kitchen board — that order is already being cooked from the aggregator's own tablet`,
    );
  }
});

test("the board excludes marketplace-kind orders even on our own channel", async () => {
  const userId = await makeUser();
  const meal = await seedOrder({ userId, kind: "meal" });
  const marketplace = await seedOrder({ userId, kind: "marketplace" });

  const res = await getBoard({ auth: true });
  const ids = new Set(res.rows.map((r) => r.id));

  assert.ok(ids.has(meal), "the own_app meal control is missing from the board");
  assert.ok(
    !ids.has(marketplace),
    "a marketplace order reached the kitchen board — nothing there is cooked",
  );
});

test("the board carries only cookable statuses", async () => {
  const userId = await makeUser();
  const cookable = await seedOrder({ userId, status: "preparing" });
  const unpaid = await seedOrder({ userId, status: "placed" });
  const done = await seedOrder({ userId, status: "ready" });
  const gone = await seedOrder({ userId, status: "delivered" });
  const dead = await seedOrder({ userId, status: "cancelled" });

  const res = await getBoard({ auth: true });
  const ids = new Set(res.rows.map((r) => r.id));

  assert.ok(ids.has(cookable), "a preparing ticket is missing from the board");
  for (const [label, id] of [
    ["placed (unpaid)", unpaid],
    ["ready", done],
    ["delivered", gone],
    ["cancelled", dead],
  ] as const) {
    assert.ok(!ids.has(id), `a ${label} order is still on the kitchen board`);
  }
});

test("a board row exposes exactly the five kitchen fields and no customer PII", async () => {
  const userId = await makeUser();
  const external = `TAN-KDS-${RUN}`;
  const orderId = await seedOrder({ userId, externalOrderId: external });

  const res = await getBoard({ auth: true });
  const row = res.rows.find((r) => r.id === orderId);
  assert.ok(row, "the seeded ticket is missing from the board");

  // The projection is the contract. A `select()` with no column list here
  // would put the customer's phone, address and order total on a screen that
  // hangs in the kitchen — pin the shape so widening it is a deliberate act.
  assert.deepEqual(
    Object.keys(row).sort(),
    ["createdAt", "externalOrderId", "id", "items", "status"],
  );
  assert.equal(row.externalOrderId, external);
  assert.equal(row.status, "preparing");
  assert.ok(Array.isArray(row.items), "items did not round-trip as an array");
  assert.ok(Number.isFinite(Date.parse(row.createdAt)), "createdAt is not parseable");
});

test("the board is ordered oldest first — the kitchen cooks in the order it was ordered", async () => {
  const userId = await makeUser();
  const base = Date.parse("2026-03-01T09:00:00.000Z");
  const older = await seedOrder({ userId, createdAt: new Date(base) });
  const newer = await seedOrder({ userId, createdAt: new Date(base + 5 * 60_000) });

  const res = await getBoard({ auth: true });
  const positions = res.rows.map((r) => r.id);
  const iOlder = positions.indexOf(older);
  const iNewer = positions.indexOf(newer);
  assert.ok(iOlder >= 0 && iNewer >= 0, "seeded tickets are missing from the board");
  assert.ok(iOlder < iNewer, "the board put a newer ticket ahead of an older one");
});

test("marking an own-app meal ticket ready advances it and takes it off the board", async () => {
  const userId = await makeUser();
  const orderId = await seedOrder({ userId, status: "preparing" });

  const res = await postReady(orderId, { auth: true });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(await statusOf(orderId), "ready");

  const after = await getBoard({ auth: true });
  assert.ok(
    !after.rows.some((r) => r.id === orderId),
    "a ticket marked ready is still on the board",
  );
});

test("marking a ticket ready twice answers 404 order_not_on_board the second time", async () => {
  const userId = await makeUser();
  const orderId = await seedOrder({ userId });

  assert.equal((await postReady(orderId, { auth: true })).status, 200);

  // This is the exact case the board's optimistic Ready button reads as "it
  // was already advanced, possibly from another screen — do not restore it".
  const second = await postReady(orderId, { auth: true });
  assert.equal(second.status, 404);
  assert.equal(second.body["ok"], false);
  assert.equal(second.body["code"], "order_not_on_board");
  assert.equal(await statusOf(orderId), "ready");
});

test("ready refuses aggregator and marketplace orders with 404 and changes nothing", async () => {
  const userId = await makeUser();
  const control = await seedOrder({ userId, status: "preparing" });

  const traps: Array<{ label: string; id: number }> = [];
  for (const channel of ["zomato", "swiggy", "pos", "other"] as const) {
    traps.push({
      label: channel,
      id: await seedOrder({ userId, channel, status: "preparing" }),
    });
  }
  traps.push({
    label: "marketplace",
    id: await seedOrder({ userId, kind: "marketplace", status: "preparing" }),
  });

  for (const trap of traps) {
    const res = await postReady(trap.id, { auth: true });
    assert.equal(res.status, 404, `${trap.label} order was accepted by ready`);
    assert.equal(res.body["code"], "order_not_on_board");
    // Refusal, not rollback: the row must be untouched.
    assert.equal(
      await statusOf(trap.id),
      "preparing",
      `${trap.label} order had its status moved`,
    );
  }

  // Matched pair: the identical own_app meal row does advance, so the 404s
  // above are the channel/kind predicate and not a route that refuses all.
  assert.equal((await postReady(control, { auth: true })).status, 200);
  assert.equal(await statusOf(control), "ready");
});

test("ready answers 404 for an id that does not exist", async () => {
  const res = await postReady(2_000_000_000, { auth: true });
  assert.equal(res.status, 404);
  assert.equal(res.body["code"], "order_not_on_board");
});

test("ready cannot drag an order backwards out of a terminal status", async () => {
  const userId = await makeUser();

  // The severe half of the missing status predicate. `ready` merely made the
  // 404 unreachable; these would rewrite history — a delivered order back to
  // ready, or a cancelled one resurrected onto the board to be cooked. A
  // stale kitchen tab left open for an hour is enough to reach both.
  for (const status of [
    "ready",
    "rider_assigned",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ]) {
    const orderId = await seedOrder({ userId, status });
    const res = await postReady(orderId, { auth: true });
    assert.equal(res.status, 404, `a ${status} order was advanced by the board`);
    assert.equal(res.body["code"], "order_not_on_board");
    assert.equal(
      await statusOf(orderId),
      status,
      `a ${status} order had its status rewritten to ready`,
    );
  }
});

test("ready refuses an UNPAID (placed) own_app ticket — 404, status untouched", async () => {
  // The paid-fulfilment invariant at the write chokepoint: the placed→ready
  // edge would let an abandoned checkout be cooked, and verify's PAID_STATES
  // short-circuit would later answer success for it without ever persisting
  // a payment id. The board constant excludes "placed", and because the
  // ready mutation's atomic UPDATE shares that constant, this is enforced in
  // the WHERE clause, not display filtering.
  const userId = await makeUser();
  const unpaid = await seedOrder({ userId, status: "placed" });

  const res = await postReady(unpaid, { auth: true });
  assert.equal(res.status, 404, "an unpaid order was advanced by the board");
  assert.equal(res.body["code"], "order_not_on_board");
  assert.equal(await statusOf(unpaid), "placed", "the unpaid order's status was rewritten");
});

test("ready answers 404, not 500, for a non-numeric order id", async () => {
  // The board only ever sends ids it read off a ticket, so this is reachable
  // by hand-rolled requests. It still must not become an unhandled database
  // error: parseInt("abc") is NaN, and an unguarded NaN reaches Postgres as
  // an invalid integer literal.
  const res = await postReady("not-a-number", { auth: true });
  assert.equal(res.status, 404);
  assert.equal(res.body["code"], "order_not_on_board");
});
