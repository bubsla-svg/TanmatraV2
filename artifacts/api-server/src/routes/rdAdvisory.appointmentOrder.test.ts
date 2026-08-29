/**
 * DB-backed money-path test for the paid-consult Razorpay flow added to
 * rdAdvisory.ts:
 *   POST /rd/appointments/:id/checkout — opens a gateway order for the
 *     SERVER-priced amount (pricePaise from RD_PRICING; the client never sends a
 *     price), stores razorpay_order_id.
 *   POST /rd/appointments/:id/verify — HMAC-verifies the signature, binds it to
 *     THIS appointment, and flips paymentStatus pending → paid.
 *
 * Razorpay is shimmed at globalThis.fetch (no real gateway / secret needed).
 * Harness mirrors payments.subscriptionOrder.test.ts (fetch shim + x-test-user-id
 * auth stub + makeUser + api()).
 *
 * Run: node --test --import tsx ./src/routes/rdAdvisory.appointmentOrder.test.ts
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
import { db, usersTable, rdAppointmentsTable } from "@workspace/db";

import rdRouter from "./rdAdvisory";

const KEY_ID = "rzp_test_appt";
const KEY_SECRET = "secret_appt_test";
process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
const RUN = randomUUID().slice(0, 8);

// Anjali's follow_up_30m price in paise — the server source of truth (RD_PRICING).
const PAID_PRICE = 120000;

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
      const id = `order_appt_${++orderSeq}_${RUN}`;
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
  app.use(rdRouter);
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
      .delete(rdAppointmentsTable)
      .where(inArray(rdAppointmentsTable.userId, CREATED_USER_IDS));
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
    email: `appt-${label}-${id}@example.test`,
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

/** Book an appointment on a real open slot pulled from /rd/slots. */
async function book(user: TestUser, kind: string, rdSlug = "rd-anjali-nair"): Promise<any> {
  const slotsRes = await api("GET", `/rd/slots?rdSlug=${rdSlug}&kind=${kind}`, undefined);
  assert.equal(slotsRes.status, 200, JSON.stringify(slotsRes.json));
  const slot = slotsRes.json.slots?.[0];
  assert.ok(slot, `expected an open ${kind} slot`);
  const res = await api(
    "POST",
    "/rd/appointments",
    { rdSlug, kind, startAt: slot.startAt, endAt: slot.endAt },
    user,
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return res.json.appointment;
}

async function apptRow(id: number) {
  const [row] = await db
    .select()
    .from(rdAppointmentsTable)
    .where(eq(rdAppointmentsTable.id, id))
    .limit(1);
  return row ?? null;
}

test("paid consult: checkout prices from the server (RD_PRICING); verify flips pending→paid", async () => {
  const user = await makeUser("payer");
  const appt = await book(user, "follow_up_30m");
  assert.equal(appt.paymentStatus, "pending", "a paid consult books as pending, not auto-paid");

  const ordersBefore = rzpOrders.length;
  const checkout = await api("POST", `/rd/appointments/${appt.id}/checkout`, {}, user);
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));
  assert.equal(checkout.json.keyId, KEY_ID);
  // Server owns the amount: the gateway order was opened for pricePaise.
  assert.equal(checkout.json.amount, PAID_PRICE);
  assert.equal(rzpOrders.length, ordersBefore + 1);
  assert.equal(rzpOrders.at(-1)!.amount, PAID_PRICE, "server must POST pricePaise to Razorpay");
  const razorpayOrderId = checkout.json.razorpayOrderId as string;
  assert.ok(razorpayOrderId);

  const paymentId = `pay_appt_${razorpayOrderId}`;
  const verify = await api(
    "POST",
    `/rd/appointments/${appt.id}/verify`,
    {
      razorpayPaymentId: paymentId,
      razorpayOrderId,
      razorpaySignature: sign(razorpayOrderId, paymentId),
    },
    user,
  );
  assert.equal(verify.status, 200, JSON.stringify(verify.json));
  assert.equal(verify.json.paymentStatus, "paid");

  const row = await apptRow(appt.id);
  assert.equal(row!.paymentStatus, "paid");
  assert.equal(row!.razorpayOrderId, razorpayOrderId);
  assert.equal(row!.razorpayPaymentId, paymentId);
});

test("a checkout retry reuses the pending gateway order — the first capture's binding survives", async () => {
  // The regression this pins: a retry used to mint a FRESH Razorpay order and
  // overwrite the stored razorpayOrderId that verify's guarded update binds
  // on — orphaning a capture of the first order (appointments are not in
  // ordersTable, so the webhook cannot recover it either).
  const user = await makeUser("retry");
  const appt = await book(user, "follow_up_30m");
  const first = await api("POST", `/rd/appointments/${appt.id}/checkout`, {}, user);
  assert.equal(first.status, 200, JSON.stringify(first.json));
  const ordersAfterFirst = rzpOrders.length;

  const second = await api("POST", `/rd/appointments/${appt.id}/checkout`, {}, user);
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.equal(
    second.json.razorpayOrderId,
    first.json.razorpayOrderId,
    "a retry must return the SAME gateway order, never mint a new one",
  );
  assert.equal(second.json.amount, PAID_PRICE);
  assert.equal(rzpOrders.length, ordersAfterFirst, "no second POST /v1/orders may fire");

  // The point of the reuse: a payment of the FIRST order still verifies.
  const paymentId = `pay_appt_retry_${first.json.razorpayOrderId}`;
  const verify = await api(
    "POST",
    `/rd/appointments/${appt.id}/verify`,
    {
      razorpayPaymentId: paymentId,
      razorpayOrderId: first.json.razorpayOrderId,
      razorpaySignature: sign(first.json.razorpayOrderId, paymentId),
    },
    user,
  );
  assert.equal(verify.status, 200, JSON.stringify(verify.json));
  assert.equal((await apptRow(appt.id))!.paymentStatus, "paid");
});

test("a bad signature is rejected and the appointment stays pending", async () => {
  const user = await makeUser("badsig");
  const appt = await book(user, "follow_up_45m");
  const checkout = await api("POST", `/rd/appointments/${appt.id}/checkout`, {}, user);
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));
  const razorpayOrderId = checkout.json.razorpayOrderId as string;

  const verify = await api(
    "POST",
    `/rd/appointments/${appt.id}/verify`,
    {
      razorpayPaymentId: "pay_forged",
      razorpayOrderId,
      razorpaySignature: "deadbeef".repeat(8), // not a valid HMAC
    },
    user,
  );
  assert.equal(verify.status, 400);
  const row = await apptRow(appt.id);
  assert.equal(row!.paymentStatus, "pending", "a bad signature must NOT mark paid");
  assert.equal(row!.razorpayPaymentId, null);
});

test("a free intro has nothing to pay — checkout 409", async () => {
  const user = await makeUser("free");
  const appt = await book(user, "intro_15m");
  assert.equal(appt.paymentStatus, "free");
  const checkout = await api("POST", `/rd/appointments/${appt.id}/checkout`, {}, user);
  assert.equal(checkout.status, 409);
});

test("checkout requires auth + ownership", async () => {
  const owner = await makeUser("owner");
  const appt = await book(owner, "follow_up_30m");
  const anon = await api("POST", `/rd/appointments/${appt.id}/checkout`, {});
  assert.equal(anon.status, 401, "signed-out checkout must be 401");
  const other = await makeUser("other");
  const foreign = await api("POST", `/rd/appointments/${appt.id}/checkout`, {}, other);
  assert.equal(foreign.status, 404, "another user cannot check out someone else's appointment");
});
