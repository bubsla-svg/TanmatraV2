/**
 * Integration tests for the previously-untested referral + loyalty-progress
 * routes on the real loyalty router:
 *
 *   1. GET /referral/me lazily allocates a stable code and returns the
 *      current award amounts + the caller's own redemptions list.
 *   2. POST /referral/redeem validates (own code / unknown code / already
 *      redeemed) and records a PENDING redemption — no credit at redeem time.
 *   3. The actual award is server-owned and fires inside finalizeOrder, only
 *      on the referee's first-ever order: both sides get credited atomically,
 *      the redemption's awardedAt/firstOrderId are stamped, and a duplicate
 *      finalize call does not double-award.
 *   4. GET /loyalty/progress reports the per-subscription delivered-delivery
 *      counters the UI reads (free-delivery cycle + one-time premium-unlock
 *      bonus — a cash bonus, NOT premium-dish ordering access).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/loyalty.referral.test.ts
 *
 * Stands up a tiny express app on a random port mounting the real loyalty
 * router with a stubbed auth middleware — same harness as
 * loyalty.checkout.test.ts.
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
import { eq, inArray } from "drizzle-orm";
import {
  creditLedgerTable,
  db,
  orderClaimsTable,
  ordersTable,
  pickupLocationsTable,
  referralCodesTable,
  referralRedemptionsTable,
  subscriptionDeliveriesTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { TEST_DISHES as DISHES } from "../test-fixtures/dishes.js";

import loyaltyRouter from "./loyalty";

// Premium-only slugs are gated at the route layer; a plain referral/loyalty
// test has no business tripping that gate, so keep well clear of them (same
// list as loyalty.checkout.test.ts).
const PREMIUM_SLUGS = new Set([
  "alfredo-pasta-prawns",
  "pesto-pasta-prawns",
  "crispy-peri-peri-chicken-burrito-wrap",
]);

interface TestUser {
  id: string;
  firstName: string;
  email: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_PICKUP_IDS: number[] = [];
const CREATED_SUB_IDS: number[] = [];
const USER_REGISTRY = new Map<string, TestUser>();

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
  app.use(loyaltyRouter);
  return app;
}

// Unlike loyaltyEngine.checkout.test.ts's makeUser, this one does NOT seed a
// prior order — the referral award only fires on the referee's first-EVER
// order (orderCount === 1 inside finalizeOrder), so a referee test user must
// start with zero orders for that assertion to mean anything.
async function makeUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `referral-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const user: TestUser = { id, firstName: label, email: `referral-${label}@example.test` };
  USER_REGISTRY.set(id, user);
  return user;
}

async function makePickup(): Promise<number> {
  const [loc] = await db
    .insert(pickupLocationsTable)
    .values({
      name: `Referral Test Pickup ${randomUUID().slice(0, 6)}`,
      addressLine: "1 Test St",
      city: "Bengaluru",
      pincode: "560001",
      lat: 12.97,
      lng: 77.59,
      discountPaise: 0,
      active: true,
    })
    .returning();
  CREATED_PICKUP_IDS.push(loc!.id);
  return loc!.id;
}

function pickAvailableDish() {
  const d = DISHES.find((d) => d.isAvailable && !PREMIUM_SLUGS.has(d.slug) && d.price > 0);
  if (!d) throw new Error("no usable dish in catalog");
  return d;
}

async function api(
  method: string,
  path: string,
  body: unknown,
  user: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-user-id": user.id,
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
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  if (CREATED_SUB_IDS.length > 0) {
    await db
      .delete(subscriptionDeliveriesTable)
      .where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(referralRedemptionsTable)
      .where(inArray(referralRedemptionsTable.refereeUserId, CREATED_USER_IDS));
    await db.delete(referralCodesTable).where(inArray(referralCodesTable.userId, CREATED_USER_IDS));
    await db.delete(orderClaimsTable).where(inArray(orderClaimsTable.userId, CREATED_USER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(creditLedgerTable).where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  for (const id of CREATED_PICKUP_IDS) {
    await db.delete(pickupLocationsTable).where(eq(pickupLocationsTable.id, id));
  }
});

test("GET /referral/me lazily allocates a stable code with no redemptions for a fresh user", async () => {
  const user = await makeUser("Fresh");
  const first = await api("GET", "/referral/me", undefined, user);
  assert.equal(first.status, 200);
  assert.ok(first.json.code, "must allocate a code");
  assert.equal(typeof first.json.awards.referrerPaise, "number");
  assert.ok(first.json.awards.referrerPaise > 0);
  assert.equal(typeof first.json.awards.refereePaise, "number");
  assert.deepEqual(first.json.redemptions, []);

  const second = await api("GET", "/referral/me", undefined, user);
  assert.equal(second.json.code, first.json.code, "the same user must always get the same code back");
});

test("POST /referral/redeem rejects a user's own code (400) and an unknown code (404)", async () => {
  const user = await makeUser("SelfRedeem");
  const me = await api("GET", "/referral/me", undefined, user);

  const own = await api("POST", "/referral/redeem", { code: me.json.code }, user);
  assert.equal(own.status, 400);
  assert.match(String(own.json.error), /own code/i);

  const unknown = await api("POST", "/referral/redeem", { code: "NOSUCHCODE99" }, user);
  assert.equal(unknown.status, 404);
});

test("POST /referral/redeem records a PENDING redemption (no credit yet), and a second attempt 409s regardless of code", async () => {
  const referrerA = await makeUser("ReferrerA");
  const referrerB = await makeUser("ReferrerB");
  const referee = await makeUser("RedeemOnce");
  const codeA = (await api("GET", "/referral/me", undefined, referrerA)).json.code;
  const codeB = (await api("GET", "/referral/me", undefined, referrerB)).json.code;

  const redeemed = await api("POST", "/referral/redeem", { code: codeA }, referee);
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.json.status, "pending_first_order");
  assert.equal(redeemed.json.awardedPaise, 0, "no credit is issued at redemption time");
  assert.equal(redeemed.json.redemption.awardedAt, null);

  // A second attempt — even against a DIFFERENT referrer's code — must 409,
  // since the uniqueness is per-referee (one redemption ever), not per-code.
  const again = await api("POST", "/referral/redeem", { code: codeB }, referee);
  assert.equal(again.status, 409);
  assert.match(String(again.json.error), /already redeemed/i);
});

test("the referral award fires atomically on the referee's first finalize, credits both sides once, and does not double-award on a duplicate finalize", async () => {
  const referrer = await makeUser("AwardReferrer");
  const referee = await makeUser("AwardReferee");
  const code = (await api("GET", "/referral/me", undefined, referrer)).json.code;

  const redeemed = await api("POST", "/referral/redeem", { code }, referee);
  assert.equal(redeemed.status, 200);
  const { referrerAwardPaise, refereeAwardPaise } = redeemed.json.redemption;

  const pickupLocationId = await makePickup();
  const dish = pickAvailableDish();
  const orderId = `ord-${randomUUID()}`;
  const body = {
    orderId,
    fulfillmentType: "pickup",
    pickupLocationId,
    items: [{ id: dish.id, name: dish.name, qty: 1, price: dish.price }],
  };

  const finalize = await api("POST", "/orders/finalize", body, referee);
  assert.equal(finalize.status, 200, `finalize must succeed: ${JSON.stringify(finalize.json)}`);
  assert.equal(finalize.json.referral.awarded, true);

  // Duplicate finalize (same orderId, e.g. a client retry with a fresh
  // Idempotency-Key) must report the claim already exists and must NOT
  // re-run the referral award.
  const retry = await api("POST", "/orders/finalize", body, referee);
  assert.equal(retry.json.duplicate, true);
  assert.equal(retry.json.referral.awarded, false);
  assert.equal(retry.json.referral.reason, "order_already_claimed");

  // The redemption row is stamped exactly once.
  const [row] = await db
    .select()
    .from(referralRedemptionsTable)
    .where(eq(referralRedemptionsTable.refereeUserId, referee.id));
  assert.ok(row?.awardedAt, "awardedAt must be set");
  assert.equal(row!.firstOrderId, orderId);

  // Both sides' credit ledgers reflect exactly the amounts locked in at
  // redemption time — GET /credit-ledger is the same route file, so this
  // also exercises that endpoint end to end.
  const referrerLedger = await api("GET", "/credit-ledger", undefined, referrer);
  const referrerEntries = referrerLedger.json.entries.filter(
    (e: { reason: string }) => e.reason === "referral_referrer_award",
  );
  assert.equal(referrerEntries.length, 1, "the referrer must be credited exactly once, even after the duplicate finalize");
  assert.equal(referrerEntries[0].deltaPaise, referrerAwardPaise);

  const refereeLedger = await api("GET", "/credit-ledger", undefined, referee);
  const refereeEntries = refereeLedger.json.entries.filter(
    (e: { reason: string }) => e.reason === "referral_referee_signup",
  );
  assert.equal(refereeEntries.length, 1, "the referee must be credited exactly once");
  assert.equal(refereeEntries[0].deltaPaise, refereeAwardPaise);
});

test("GET /loyalty/progress reports delivered-delivery counters at the free and premium-unlock boundaries", async () => {
  const user = await makeUser("ProgressUser");
  const now = new Date();
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: user.id,
      cadence: "weekly",
      mealsPerDelivery: 5,
      deliveryWindow: "morning",
      status: "active",
      startDate: now,
      nextDeliveryAt: now,
      pricePerDeliveryPaise: 39900,
    })
    .returning();
  CREATED_SUB_IDS.push(sub!.id);

  // 8 delivered rows: exactly the default premiumUnlockDeliveries (8) AND a
  // clean multiple of the default loyaltyFreeEveryN (4) — exercises both
  // boundaries ("just unlocked the premium bonus" + "just completed a free
  // cycle") in one seed.
  for (let i = 0; i < 8; i++) {
    await db.insert(subscriptionDeliveriesTable).values({
      subscriptionId: sub!.id,
      scheduledFor: now,
      deliveryWindow: "morning",
      status: "delivered",
    });
  }

  const res = await api("GET", "/loyalty/progress", undefined, user);
  assert.equal(res.status, 200);
  const row = res.json.progress.find((p: { subscriptionId: number }) => p.subscriptionId === sub!.id);
  assert.ok(row, "the seeded subscription must appear in progress");
  assert.equal(row.deliveredCount, 8);
  assert.equal(row.freeEveryN, 4);
  assert.equal(row.deliveriesUntilFree, 4, "at an exact multiple, the next free cycle needs a full 4 more");
  assert.equal(row.premiumUnlockAt, 8);
  assert.equal(row.deliveriesUntilPremium, 0);
  assert.equal(row.premiumUnlocked, true, "premiumUnlocked is a CASH bonus flag, not premium-dish ordering access");
});
