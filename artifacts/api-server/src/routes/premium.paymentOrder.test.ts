/**
 * DB-backed money-path test for the premium-membership Razorpay flow added to
 * premium.ts:
 *   POST /premium/checkout — opens a gateway order for the SERVER price
 *     (PREMIUM_PRICE_PAISE; the client never sends a price), creates/reuses a
 *     `pending_payment` row and stores razorpay_order_id.
 *   POST /premium/verify — HMAC-verifies the signature, binds it to THIS
 *     membership's stored order, and flips status pending_payment → active.
 *
 * Razorpay is shimmed at globalThis.fetch (no real gateway / secret needed).
 * Harness mirrors rdAdvisory.appointmentOrder.test.ts.
 *
 * Run: node --test --import tsx ./src/routes/premium.paymentOrder.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, premiumMembershipsTable } from "@workspace/db";

import premiumRouter from "./premium";

const KEY_ID = "rzp_test_premium";
const KEY_SECRET = "secret_premium_test";
process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
const RUN = randomUUID().slice(0, 8);

// The server source of truth — PREMIUM_PRICE_PAISE in premium.ts.
const PREMIUM_PRICE = 99900;

// --- Razorpay fetch shim: intercept api.razorpay.com only; record order amounts.
const realFetch = globalThis.fetch;
let orderSeq = 0;
const rzpOrders: Array<{ id: string; amount: number }> = [];
function jsonResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  } as unknown as Response;
}
globalThis.fetch = (async (input: any, init?: any) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input?.url ?? String(input));
  const method = (init?.method || "GET").toUpperCase();
  if (url.includes("api.razorpay.com")) {
    if (url.endsWith("/v1/orders") && method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const id = `order_prem_${++orderSeq}_${RUN}`;
      rzpOrders.push({ id, amount: body.amount });
      return jsonResponse({ id, amount: body.amount, currency: body.currency });
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "unhandled rzp mock route", url }),
      text: async () => "",
    } as unknown as Response;
  }
  return realFetch(input, init);
}) as typeof fetch;

// --- Test app ---
interface TestUser {
  id: string;
}
const REGISTRY = new Map<string, TestUser>();
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
    const u = headerId ? REGISTRY.get(headerId) : undefined;
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
  app.use(premiumRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  globalThis.fetch = realFetch;
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(premiumMembershipsTable)
      .where(inArray(premiumMembershipsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function api(
  method: string,
  path: string,
  body: unknown,
  user?: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function makeUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `prem-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

/** Razorpay's client-side signature: HMAC-SHA256("<orderId>|<paymentId>", key_secret). */
function sign(orderId: string, paymentId: string): string {
  return createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

async function membershipRow(userId: string) {
  const [row] = await db
    .select()
    .from(premiumMembershipsTable)
    .where(eq(premiumMembershipsTable.userId, userId))
    .limit(1);
  return row ?? null;
}

test("premium checkout prices from the server; verify flips pending_payment→active", async () => {
  const user = await makeUser("payer");
  const ordersBefore = rzpOrders.length;
  const checkout = await api("POST", "/premium/checkout", {}, user);
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));
  assert.equal(checkout.json.keyId, KEY_ID);
  // Server owns the amount: the gateway order was opened for PREMIUM_PRICE_PAISE.
  assert.equal(checkout.json.amount, PREMIUM_PRICE);
  assert.equal(rzpOrders.length, ordersBefore + 1);
  assert.equal(rzpOrders.at(-1)!.amount, PREMIUM_PRICE, "server must POST the price to Razorpay");
  const razorpayOrderId = checkout.json.razorpayOrderId as string;
  assert.ok(razorpayOrderId);

  const pending = await membershipRow(user.id);
  assert.equal(pending!.status, "pending_payment", "checkout leaves a pending_payment row");

  const paymentId = `pay_prem_${razorpayOrderId}`;
  const verify = await api(
    "POST",
    "/premium/verify",
    {
      razorpayPaymentId: paymentId,
      razorpayOrderId,
      razorpaySignature: sign(razorpayOrderId, paymentId),
    },
    user,
  );
  assert.equal(verify.status, 200, JSON.stringify(verify.json));
  assert.equal(verify.json.isPremium, true);

  const row = await membershipRow(user.id);
  assert.equal(row!.status, "active");
  assert.equal(row!.razorpayOrderId, razorpayOrderId);
  assert.equal(row!.razorpayPaymentId, paymentId);
});

test("a bad signature is rejected and the membership stays pending_payment", async () => {
  const user = await makeUser("badsig");
  const checkout = await api("POST", "/premium/checkout", {}, user);
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));

  const verify = await api(
    "POST",
    "/premium/verify",
    {
      razorpayPaymentId: "pay_forged",
      razorpayOrderId: checkout.json.razorpayOrderId,
      razorpaySignature: "deadbeef".repeat(8), // not a valid HMAC
    },
    user,
  );
  assert.equal(verify.status, 400);
  const row = await membershipRow(user.id);
  assert.equal(row!.status, "pending_payment", "a bad signature must NOT activate");
  assert.equal(row!.razorpayPaymentId, null);
});

test("an already-active member cannot check out again (409)", async () => {
  const user = await makeUser("member");
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(premiumMembershipsTable).values({
    userId: user.id,
    status: "active",
    monthlyPricePaise: PREMIUM_PRICE,
    startedAt: now,
    currentPeriodEnd: later,
  });
  const checkout = await api("POST", "/premium/checkout", {}, user);
  assert.equal(checkout.status, 409, JSON.stringify(checkout.json));
});

test("checkout requires auth", async () => {
  const anon = await api("POST", "/premium/checkout", {});
  assert.equal(anon.status, 401, "signed-out checkout must be 401");
});
