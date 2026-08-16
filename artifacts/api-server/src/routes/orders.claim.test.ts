/**
 * Integration tests for POST /orders/:externalOrderId/claim (orders.ts) — the
 * guest→account attach behind plan item 2.4.
 *
 * `lib/orderClaim.test.ts` pins the decision. This pins the two things only a
 * real database can answer:
 *
 *   - the claim actually MOVES the row, and the order then shows up in
 *     `/orders/mine`. That round trip is the entire promise the confirmation
 *     screen makes; a claim that returns ok and leaves `user_id` null would
 *     pass every unit test and still hand the customer an empty history.
 *   - a refusal leaves ownership exactly as it was. A partial claim is the one
 *     outcome worse than no claim at all.
 *
 * Harness mirrors orders.mine.test.ts: test express app, per-request auth stub
 * from an x-test-user-id header, req.log stub, http server on port 0, direct db
 * seeding with after() cleanup. Needs DATABASE_URL (CI: money-integration).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/orders.claim.test.ts
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

import ordersRouter from "./orders";

const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `TAN-CLAIM-${name}-${RUN}`;

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

/** Distinct 10-digit mobiles per run so the users table's UNIQUE phone_e164
 *  never collides with a concurrent suite or a leftover row. */
let phoneSeq = 0;
function nextMobile(): string {
  phoneSeq += 1;
  return `9${String(Date.now()).slice(-6)}${String(phoneSeq).padStart(3, "0")}`;
}

async function makeUser(label: string, mobile: string | null): Promise<{ id: string; mobile: string | null }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `orders-claim-${label}-${id}@example.test`,
    firstName: label,
    ...(mobile ? { phoneE164: `+91${mobile}`, phoneVerifiedAt: new Date() } : {}),
  });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return { ...user, mobile };
}

async function seedOrder(fields: {
  userId: string | null;
  externalOrderId: string;
  phone: string | null;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: fields.userId,
      externalOrderId: fields.externalOrderId,
      orderChannel: "own_app",
      status: "delivered",
      totalPaise: 41800,
      orderKind: "meal",
      phone: fields.phone,
      items: [{ id: 16, name: "Avocado Toast", qty: 1, price: 24000 }],
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function claim(
  externalOrderId: string,
  userId?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(externalOrderId)}/claim`, {
    method: "POST",
    headers: userId ? { "x-test-user-id": userId } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function ownerOf(orderId: number): Promise<string | null> {
  const [row] = await db
    .select({ userId: ordersTable.userId })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  return row?.userId ?? null;
}

// ---------------------------------------------------------------------------

test("unauthenticated claim is refused before any DB read", async () => {
  const id = ext("anon");
  await seedOrder({ userId: null, externalOrderId: id, phone: nextMobile() });
  const r = await claim(id);
  assert.equal(r.status, 401);
});

test("a matching phone claims the order, and it then appears in /orders/mine", async () => {
  // The round trip is the point. Everything else in 2.4 is a promise that this
  // one assertion either keeps or breaks.
  const mobile = nextMobile();
  const user = await makeUser("match", mobile);
  const id = ext("match");
  const orderId = await seedOrder({ userId: null, externalOrderId: id, phone: mobile });

  const r = await claim(id, user.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.claimed, true);
  assert.equal(await ownerOf(orderId), user.id);

  const mine = await fetch(`${baseUrl}/orders/mine`, { headers: { "x-test-user-id": user.id } });
  const body = (await mine.json()) as { orders: { externalOrderId: string }[] };
  assert.ok(
    body.orders.some((o) => o.externalOrderId === id),
    "a claimed order that never shows in the history is the defect this item exists to fix",
  );
});

test("the phone is matched canonically, not as the buyer typed it", async () => {
  // The order carries free text from an input; the session carries the OTP
  // flow's stored `+91…`. If these were compared as strings the claim would
  // refuse every real customer while every unit test stayed green.
  const mobile = nextMobile();
  const user = await makeUser("typed", mobile);
  const id = ext("typed");
  const orderId = await seedOrder({
    userId: null,
    externalOrderId: id,
    phone: `0${mobile.slice(0, 5)} ${mobile.slice(5)}`,
  });

  const r = await claim(id, user.id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await ownerOf(orderId), user.id);
});

test("a different phone is refused and the order stays unowned", async () => {
  const user = await makeUser("other", nextMobile());
  const id = ext("mismatch");
  const orderId = await seedOrder({ userId: null, externalOrderId: id, phone: nextMobile() });

  const r = await claim(id, user.id);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "phone_mismatch");
  assert.equal(await ownerOf(orderId), null, "a refused claim must not half-move the row");
});

test("an order already owned is not claimable, and the owner is unchanged", async () => {
  // The "two accounts on one household number" variant of this is a unit test
  // (orderClaim.test.ts) rather than an integration one: users.phone_e164 is
  // UNIQUE, so two verified accounts cannot hold the same number here. The
  // ordering of the checks still has to be right in case that ever changes,
  // which is exactly what a pure test is for.
  const owner = await makeUser("owner", nextMobile());
  const other = await makeUser("other-acct", nextMobile());
  const id = ext("owned");
  const orderId = await seedOrder({ userId: owner.id, externalOrderId: id, phone: null });

  const r = await claim(id, other.id);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "owned_by_other");
  assert.equal(await ownerOf(orderId), owner.id);
});

test("re-claiming your own order is a success, not an error", async () => {
  // The confirmation island claims on mount and the page can be refreshed.
  const mobile = nextMobile();
  const user = await makeUser("repeat", mobile);
  const id = ext("repeat");
  await seedOrder({ userId: null, externalOrderId: id, phone: mobile });

  const first = await claim(id, user.id);
  assert.equal(first.body.claimed, true);
  const second = await claim(id, user.id);
  assert.equal(second.status, 200);
  assert.equal(second.body.claimed, false);
  assert.equal(second.body.code, "already_yours");
});

test("an unknown order id answers 403, not 404", async () => {
  // A 404 here would confirm which ids exist to anyone holding a session.
  const user = await makeUser("probe", nextMobile());
  const r = await claim(ext("nope-does-not-exist"), user.id);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "unknown_order");
});

test("an order with no contact number cannot be claimed by anyone", async () => {
  const user = await makeUser("nophone", nextMobile());
  const id = ext("blank");
  const orderId = await seedOrder({ userId: null, externalOrderId: id, phone: null });

  const r = await claim(id, user.id);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "unprovable");
  assert.equal(await ownerOf(orderId), null);
});
