/**
 * FULL-LIFECYCLE CHAIN test — the connected e2e state machine.
 *
 * Every other subscription test in this repo exercises ONE transition
 * against freshly-seeded state (e.g. the halt test seeds a subscription
 * already primed with N-1 failures; the reactivate test seeds a subscription
 * directly in status:"halted"). That proves each transition is individually
 * correct, but NOT that they compose — that the same subscription+mandate row
 * can be driven through the whole lifecycle and land in the right state at
 * every step.
 *
 * This test drives ONE shared subscription+mandate+delivery through the
 * entire money-path lifecycle in a single connected sequence, through the
 * REAL routes and the REAL charge core, asserting DB state after each step:
 *
 *   activated/authenticated  (active subscription + active mandate — the
 *                             realistic post-first-payment starting state)
 *     → charged              (cycle-2 recurring debit succeeds)
 *     → charged again        (cycle-3 recurring debit succeeds)
 *     → paused               (customer pauses)
 *     → resumed              (customer resumes)
 *     → halted               (3 consecutive failed debits halt billing)
 *     → reactivated          (customer clears the halt)
 *     → charged              (billing works again post-recovery)
 *     → cancelled            (customer cancels; mandate revoked)
 *
 * Run with:
 *   node --test --import tsx ./src/routes/subscriptions.fullLifecycle.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  subscriptionsTable,
  subscriptionMandatesTable,
  subscriptionDeliveriesTable,
  preDebitNotificationsTable,
  ordersTable,
} from "@workspace/db";

import subscriptionsRouter from "./subscriptions";
import { chargeMandateCore, MAX_CONSECUTIVE_CHARGE_FAILURES } from "../lib/chargeMandate";

process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_lifecycle";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test_lifecycle";

const RUN = randomUUID().slice(0, 8);
const noopLog = { info: () => {}, warn: () => {}, error: () => {} };

// ── Razorpay fetch shim ─────────────────────────────────────────────────
// `rzpMode` flips between success and charge-failure so the chain can drive
// both a real successful debit and a real failed one. Any other
// api.razorpay.com call (e.g. the best-effort token-revoke DELETE on cancel)
// returns ok so it never hits the network.
const realFetch = globalThis.fetch;
let rzpMode: "success" | "fail_charge" = "success";
let rzpSeq = 0;

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input?.url ?? String(input));
  if (typeof url === "string" && url.includes("api.razorpay.com")) {
    if (url.includes("/v1/orders")) {
      return { ok: true, status: 200, json: async () => ({ id: `order_lc_${RUN}_${rzpSeq}`, amount: 0, currency: "INR" }), text: async () => "{}" } as unknown as Response;
    }
    if (url.includes("/v1/payments/create/recurring")) {
      if (rzpMode === "fail_charge") {
        return { ok: false, status: 402, json: async () => ({ error: { description: "card declined" } }), text: async () => "card declined" } as unknown as Response;
      }
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      rzpSeq++;
      return { ok: true, status: 200, json: async () => ({ id: `pay_lc_${RUN}_${rzpSeq}`, status: "captured", amount: body.amount ?? 0 }), text: async () => "{}" } as unknown as Response;
    }
    // Any other Razorpay call (token revoke on cancel, etc.) — succeed quietly.
    return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" } as unknown as Response;
  }
  return realFetch(input, init);
}) as typeof fetch;

interface TestUser { id: string }
let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_SUB_IDS: number[] = [];
const REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: unknown; log: Record<string, (...a: unknown[]) => void>; isAuthenticated: () => boolean };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(subscriptionsRouter);
  return app;
}

async function api(method: string, path: string, body: unknown, user: TestUser) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-test-user-id": user.id },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** Arm the mandate so the next chargeMandateCore call is "due": nextChargeAt
 * in the past + a sent, >24h-old pre-debit notice for that charge date.
 * Mirrors what the real scheduler does between ticks.
 *
 * `daysAgo` gives each armed cycle a DISTINCT calendar date. The billed
 * order's externalOrderId is keyed `sub-N-mandate-M-YYYY-MM-DD`, so two
 * successful charges on the same UTC day would (correctly, idempotently)
 * collapse to one order row — real cycles are a week apart, so successive
 * successful charges here use distinct daysAgo to model that. */
async function armDue(subId: number, daysAgo: number): Promise<void> {
  const nextChargeAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  await db.update(subscriptionMandatesTable).set({ nextChargeAt }).where(eq(subscriptionMandatesTable.subscriptionId, subId));
  const scheduledChargeAt = new Date(nextChargeAt);
  scheduledChargeAt.setUTCHours(12, 0, 0, 0);
  await db.insert(preDebitNotificationsTable).values({
    subscriptionId: subId,
    scheduledChargeAt,
    status: "sent",
    dispatchedAt: new Date(nextChargeAt.getTime() - 30 * 3600 * 1000), // 30h before the charge date, past the 24h floor
  });
}

async function getSub(subId: number) {
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  return row!;
}
async function getMandate(subId: number) {
  const [row] = await db.select().from(subscriptionMandatesTable).where(eq(subscriptionMandatesTable.subscriptionId, subId));
  return row!;
}
async function countOrders(userId: string): Promise<number> {
  const rows = await db.select().from(ordersTable).where(eq(ordersTable.userId, userId));
  return rows.length;
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("full lifecycle: activated → charged×2 → paused → resumed → halted → reactivated → charged → cancelled, on ONE subscription", async () => {
  // ── activated / authenticated: the realistic post-first-payment state ──
  const userId = randomUUID();
  await db.insert(usersTable).values({ id: userId, email: `lifecycle-${RUN}-${userId}@example.test`, firstName: "Lifecycle", lastName: "Tester", phoneE164: null });
  CREATED_USER_IDS.push(userId);
  const user: TestUser = { id: userId };
  REGISTRY.set(userId, user);

  const [sub] = await db.insert(subscriptionsTable).values({
    userId,
    cadence: "weekly",
    mealsPerDelivery: 5,
    deliveryWindow: "12:00-14:00",
    status: "active",
    startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    nextDeliveryAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
    pricePerDeliveryPaise: 38000,
  }).returning();
  const subId = sub!.id;
  CREATED_SUB_IDS.push(subId);

  await db.insert(subscriptionMandatesTable).values({
    subscriptionId: subId,
    razorpayCustomerId: `cust_lc_${RUN}`,
    razorpayTokenId: `tok_lc_${RUN}`,
    status: "active",
    nextChargeAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });

  const [delivery] = await db.insert(subscriptionDeliveriesTable).values({
    subscriptionId: subId,
    scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
    deliveryWindow: "12:00-14:00",
    status: "upcoming",
    items: [],
  }).returning();
  const deliveryId = delivery!.id;

  assert.equal((await getSub(subId)).status, "active", "starts active");
  assert.equal((await getMandate(subId)).status, "active", "mandate authenticated/active");

  // ── charged (cycle 2) ──
  rzpMode = "success";
  await armDue(subId, 21);
  const charge1 = await chargeMandateCore({ subscriptionId: subId, log: noopLog });
  assert.equal(charge1.ok, true, `cycle-2 charge should succeed: ${JSON.stringify(charge1.body)}`);
  assert.equal(await countOrders(userId), 1, "one billed order after first recurring charge");
  assert.equal((await getMandate(subId)).chargeFailureCount, 0);

  // ── charged (cycle 3) ──
  await armDue(subId, 14);
  const charge2 = await chargeMandateCore({ subscriptionId: subId, log: noopLog });
  assert.equal(charge2.ok, true, `cycle-3 charge should succeed: ${JSON.stringify(charge2.body)}`);
  assert.equal(await countOrders(userId), 2, "two billed orders after second recurring charge");

  // ── paused ──
  const pause = await api("POST", `/subscriptions/${subId}/pause`, {}, user);
  assert.equal(pause.status, 200, JSON.stringify(pause.json));
  assert.equal((await getSub(subId)).status, "paused");
  {
    const [d] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
    assert.equal(d!.status, "paused", "upcoming delivery paused");
  }

  // ── resumed ──
  const resume = await api("POST", `/subscriptions/${subId}/resume`, {}, user);
  assert.equal(resume.status, 200, JSON.stringify(resume.json));
  assert.equal((await getSub(subId)).status, "active");
  {
    const [d] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
    assert.equal(d!.status, "upcoming", "delivery resumed to upcoming");
  }

  // ── halted: MAX_CONSECUTIVE_CHARGE_FAILURES consecutive failed debits ──
  rzpMode = "fail_charge";
  let lastFail: Awaited<ReturnType<typeof chargeMandateCore>> | null = null;
  for (let i = 0; i < MAX_CONSECUTIVE_CHARGE_FAILURES; i++) {
    await armDue(subId, 7 - i);
    lastFail = await chargeMandateCore({ subscriptionId: subId, log: noopLog });
    assert.equal(lastFail.ok, false, `failure ${i + 1} should not succeed`);
  }
  assert.equal((lastFail!.body as any).code, "subscription_halted", "the Nth consecutive failure halts");
  assert.equal((await getSub(subId)).status, "halted", "subscription halted after 3 failures");
  assert.equal((await getMandate(subId)).status, "halted", "mandate halted after 3 failures");
  {
    const [d] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
    assert.equal(d!.status, "paused", "halt pauses upcoming deliveries");
  }

  // ── reactivated ──
  const reactivate = await api("POST", `/subscriptions/${subId}/reactivate-billing`, {}, user);
  assert.equal(reactivate.status, 200, JSON.stringify(reactivate.json));
  assert.equal((await getSub(subId)).status, "active");
  const mReact = await getMandate(subId);
  assert.equal(mReact.status, "active", "mandate reactivated");
  assert.equal(mReact.chargeFailureCount, 0, "failure count reset on reactivate");
  {
    const [d] = await db.select().from(subscriptionDeliveriesTable).where(eq(subscriptionDeliveriesTable.id, deliveryId));
    assert.equal(d!.status, "upcoming", "reactivate resumes deliveries");
  }

  // ── charged again (billing works after recovery) ──
  rzpMode = "success";
  await armDue(subId, 3);
  const chargePostRecovery = await chargeMandateCore({ subscriptionId: subId, log: noopLog });
  assert.equal(chargePostRecovery.ok, true, `post-recovery charge should succeed: ${JSON.stringify(chargePostRecovery.body)}`);
  assert.equal(await countOrders(userId), 3, "a third billed order after recovery proves billing resumed");

  // ── cancelled ──
  const cancel = await api("POST", `/subscriptions/${subId}/cancel`, {}, user);
  assert.equal(cancel.status, 200, JSON.stringify(cancel.json));
  assert.equal((await getSub(subId)).status, "cancelled");
  const mCancel = await getMandate(subId);
  assert.equal(mCancel.status, "cancelled", "mandate revoked on cancel");
  assert.equal(mCancel.nextChargeAt, null, "nextChargeAt cleared on cancel");

  // ── terminal: a charge attempt after cancel is refused, billing stopped ──
  await db.update(subscriptionMandatesTable).set({ nextChargeAt: new Date(Date.now() - 3600 * 1000) }).where(eq(subscriptionMandatesTable.subscriptionId, subId));
  const chargeAfterCancel = await chargeMandateCore({ subscriptionId: subId, log: noopLog });
  assert.equal(chargeAfterCancel.ok, false, "no charge is possible after cancel");
  assert.equal(await countOrders(userId), 3, "order count unchanged — cancel truly stops billing");
});

after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
  }
  if (CREATED_SUB_IDS.length > 0) {
    await db.delete(subscriptionDeliveriesTable).where(inArray(subscriptionDeliveriesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(preDebitNotificationsTable).where(inArray(preDebitNotificationsTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionMandatesTable).where(inArray(subscriptionMandatesTable.subscriptionId, CREATED_SUB_IDS));
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, CREATED_SUB_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});
