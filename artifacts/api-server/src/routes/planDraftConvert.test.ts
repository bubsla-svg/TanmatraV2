/**
 * PlanDraft → Subscription origination (PR A2.4). Real Postgres.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/planDraftConvert.test.ts
 *
 * The invariant this whole file exists for:
 *
 *     one settled QuoteSnapshot → exactly one Order
 *                               → exactly one Subscription
 *                               → exactly the deliveries that quote sold
 *                               → capacity consumed exactly once
 *
 * and its negative half: an expired, superseded, stale or unpaid quote
 * produces NONE of those.
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
import cookieParser from "cookie-parser";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  deliverySlotsTable,
  deriveOperationalDate,
  ordersTable,
  planDraftConversionsTable,
  planDraftQuotesTable,
  planDraftsTable,
  slotReservationsTable,
  subscriptionDeliveriesTable,
  subscriptionsTable,
  userAddressesTable,
  usersTable,
  type PlanDraft,
} from "@workspace/db";

import planDraftsRouter from "./planDrafts";
import planDraftLineupRouter from "./planDraftLineup";
import planDraftScheduleRouter from "./planDraftSchedule";
import planDraftConvertRouter from "./planDraftConvert";
import { PLAN_DRAFT_TTL_MS } from "../lib/planDraftAuth";

const SERVICEABLE_PIN = "201301";

let server: http.Server;
let baseUrl = "";
const CREATED_DRAFTS: string[] = [];
const CREATED_USERS: string[] = [];
const CREATED_SLOTS: number[] = [];
const USER_REGISTRY = new Map<string, { id: string }>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: unknown; isAuthenticated: () => boolean };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    next();
  });
  app.use(planDraftsRouter);
  app.use(planDraftLineupRouter);
  app.use(planDraftScheduleRouter);
  app.use(planDraftConvertRouter);
  return app;
}

before(async () => {
  for (const k of [
    "PLAN_DRAFT_CREATE_PER_MIN",
    "PLAN_DRAFT_MUTATE_PER_MIN",
    "PLAN_GENERATION_PER_MIN",
    "PLAN_SHUFFLE_PER_MIN",
    "PLAN_DRAFT_READ_PER_MIN",
  ]) {
    process.env[k] = "100000";
  }
  // Origination is behind the owner containment gate; these tests exercise the
  // path behind it, and one test asserts the gate itself still refuses.
  delete process.env["PLAN_CHECKOUT_DISABLED"];
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_USERS.length > 0) {
    const subs = await db
      .select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(inArray(subscriptionsTable.userId, CREATED_USERS));
    const subIds = subs.map((s) => s.id);
    if (subIds.length > 0) {
      await db
        .delete(subscriptionDeliveriesTable)
        .where(inArray(subscriptionDeliveriesTable.subscriptionId, subIds));
    }
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USERS));
  }
  if (CREATED_SLOTS.length > 0) {
    await db
      .delete(slotReservationsTable)
      .where(inArray(slotReservationsTable.slotId, CREATED_SLOTS));
  }
  if (CREATED_DRAFTS.length > 0) {
    await db
      .delete(planDraftConversionsTable)
      .where(inArray(planDraftConversionsTable.planDraftId, CREATED_DRAFTS));
    await db
      .delete(planDraftQuotesTable)
      .where(inArray(planDraftQuotesTable.planDraftId, CREATED_DRAFTS));
    await db.delete(planDraftsTable).where(inArray(planDraftsTable.id, CREATED_DRAFTS));
  }
  if (CREATED_USERS.length > 0) {
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.userId, CREATED_USERS));
  }
  if (CREATED_SLOTS.length > 0) {
    await db.delete(deliverySlotsTable).where(inArray(deliverySlotsTable.id, CREATED_SLOTS));
  }
  if (CREATED_USERS.length > 0) {
    await db.delete(userAddressesTable).where(inArray(userAddressesTable.userId, CREATED_USERS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USERS));
  }
});

async function makeUser(label: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `a24-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USERS.push(id);
  const u = { id };
  USER_REGISTRY.set(id, u);
  return u;
}

async function makeSlot(dayOffset: number, capacity = 5, hour = 12): Promise<number> {
  const start = new Date();
  start.setUTCHours(hour, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + dayOffset);
  const [row] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate: deriveOperationalDate(start),
      startsAt: start,
      endsAt: new Date(start.getTime() + 3600_000),
      zone: "default",
      capacity,
      reservedCount: 0,
    })
    .returning();
  assert.ok(row);
  CREATED_SLOTS.push(row.id);
  return row.id;
}

async function call(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    user?: { id: string };
    cookie?: string;
    idempotencyKey?: string;
  } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.user) headers["x-test-user-id"] = init.user.id;
  if (init.cookie) headers["cookie"] = init.cookie;
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

interface Quoted {
  draftId: string;
  cookie: string;
  user: { id: string };
  quoteId: string;
  totalPaise: number;
  version: number;
  slotId: number;
}

/** A catalog-backed draft carried all the way to an active QuoteSnapshot. */
async function quotedDraft(slotId: number): Promise<Quoted> {
  const user = await makeUser("conv");
  const res = await fetch(`${baseUrl}/plan-drafts`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": user.id },
    body: JSON.stringify({ journey: "recommended", planId: "desk_fuel" }),
  });
  assert.equal(res.status, 201);
  const { draft } = (await res.json()) as { draft: PlanDraft };
  CREATED_DRAFTS.push(draft.id);
  const cookie = `plan_draft_id=${draft.id}`;

  const [addr] = await db
    .insert(userAddressesTable)
    .values({
      userId: user.id,
      label: "Home",
      line1: "1 Test Street",
      city: "Noida",
      pincode: SERVICEABLE_PIN,
      phone: "9999999999",
    })
    .returning();
  assert.ok(addr);

  await db
    .update(planDraftsTable)
    .set({
      lineup: [
        { deliveryDate: "2026-01-01", deliveryWindow: null, addressId: null, slots: [] },
      ],
      status: "lineup_ready",
      dietaryPattern: "veg",
      duration: { cycle: "weekly", renewal: "auto_renew" },
      expiresAt: new Date(Date.now() + PLAN_DRAFT_TTL_MS),
      version: 2,
    })
    .where(eq(planDraftsTable.id, draft.id));

  const opts = await call(
    `/plan-drafts/${draft.id}/delivery-options?addressId=${addr.id}`,
    { user, cookie },
  );
  const w = opts.json.dates
    .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
    .find((x: any) => x.slotId === slotId);
  assert.ok(w, `slot ${slotId} should be offered`);

  const saved = await call(`/plan-drafts/${draft.id}/delivery-schedule`, {
    method: "PUT",
    user,
    cookie,
    body: {
      version: 2,
      addressId: addr.id,
      assignments: [{ deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId }],
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const version = saved.json.draft.version as number;

  const issued = await call(`/plan-drafts/${draft.id}/quote`, {
    method: "POST",
    user,
    cookie,
    body: { version },
  });
  assert.equal(issued.status, 201, JSON.stringify(issued.json));

  return {
    draftId: draft.id,
    cookie,
    user,
    quoteId: issued.json.quote.id,
    totalPaise: issued.json.quote.totalPaise,
    version,
    slotId,
  };
}

/** A quote is never ₹0 from the catalog, so the payable path is the real one.
 *  Zeroing the stored total is how these tests reach `zero_charge` without
 *  standing up a payment gateway — the route still re-derives it server-side. */
async function makeQuoteFree(quoteId: string): Promise<void> {
  await db
    .update(planDraftQuotesTable)
    .set({ totalPaise: 0, subtotalPaise: 0, taxPaise: 0 })
    .where(eq(planDraftQuotesTable.id, quoteId));
}

async function slotReserved(slotId: number): Promise<number> {
  const [row] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, slotId));
  return row!.reservedCount;
}

// ── The happy path, and what it must produce exactly once ────────────────────

test("a settled quote becomes exactly one subscription, order and delivery set", async () => {
  const slotId = await makeSlot(9, 5, 9);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);

  const converted = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: `conv-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(converted.status, 201, JSON.stringify(converted.json));

  const subId = converted.json.subscription.id as number;
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, q.user.id));
  assert.equal(subs.length, 1, "exactly one subscription");

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, q.user.id));
  assert.equal(orders.length, 1, "exactly one order");
  assert.equal(orders[0]!.externalOrderId, `sub-${subId}`);

  const [quote] = await db
    .select()
    .from(planDraftQuotesTable)
    .where(eq(planDraftQuotesTable.id, q.quoteId));
  assert.equal(quote!.status, "consumed", "the quote is spent");

  const [draft] = await db
    .select()
    .from(planDraftsTable)
    .where(eq(planDraftsTable.id, q.draftId));
  assert.equal(draft!.status, "converted");

  // Capacity changed owner rather than being handed back.
  assert.equal(await slotReserved(slotId), 1);
  const reservations = await db
    .select()
    .from(slotReservationsTable)
    .where(eq(slotReservationsTable.planDraftQuoteId, q.quoteId));
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0]!.status, "consumed");
});

test("the deliveries created are exactly the days the quote sold", async () => {
  const slotId = await makeSlot(10, 5, 10);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);

  const [quote] = await db
    .select()
    .from(planDraftQuotesTable)
    .where(eq(planDraftQuotesTable.id, q.quoteId));
  const quotedSchedule = quote!.schedule;

  const converted = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: `sched-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(converted.status, 201, JSON.stringify(converted.json));

  const rows = await db
    .select()
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.subscriptionId, converted.json.subscription.id));
  assert.equal(
    rows.length,
    quotedSchedule.length,
    "one delivery per quoted day — no two days collapsing into one",
  );
  for (const day of quotedSchedule) {
    const match = rows.find(
      (r) =>
        deriveOperationalDate(r.scheduledFor) === day.deliveryDate &&
        r.deliveryWindow === day.deliveryWindow,
    );
    assert.ok(
      match,
      `a delivery must exist on the quoted operational date ${day.deliveryDate} ${day.deliveryWindow}; got ${JSON.stringify(
        rows.map((r) => [deriveOperationalDate(r.scheduledFor), r.deliveryWindow]),
      )}`,
    );
  }
});

test("the amount billed is the amount quoted, not a recomputed one", async () => {
  const slotId = await makeSlot(11, 5, 11);
  const q = await quotedDraft(slotId);
  // Leave the real catalog-derived total in place and settle it as a payment.
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_key";
  process.env["RAZORPAY_KEY_SECRET"] = "rzp_test_secret";
  const { createHmac } = await import("node:crypto");
  const rzpOrderId = `order_${randomUUID().slice(0, 12)}`;
  const rzpPaymentId = `pay_${randomUUID().slice(0, 12)}`;
  const signature = createHmac("sha256", "rzp_test_secret")
    .update(`${rzpOrderId}|${rzpPaymentId}`)
    .digest("hex");

  try {
    const converted = await call(`/plan-drafts/${q.draftId}/convert`, {
      method: "POST",
      user: q.user,
      cookie: q.cookie,
      idempotencyKey: `price-${randomUUID()}`,
      body: {
        quoteId: q.quoteId,
        settlement: {
          kind: "razorpay",
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId,
          razorpaySignature: signature,
        },
      },
    });
    assert.equal(converted.status, 201, JSON.stringify(converted.json));
    assert.ok(q.totalPaise > 0, "precondition: the catalog priced this plan");
    assert.equal(
      converted.json.order.chargePaise,
      q.totalPaise,
      "the order bills the frozen quote total",
    );
    assert.equal(converted.json.subscription.pricePerDeliveryPaise, q.totalPaise);
    assert.equal(converted.json.conversion.settledPaise, q.totalPaise);
    assert.equal(converted.json.conversion.settlementRef, rzpPaymentId);
  } finally {
    delete process.env["RAZORPAY_KEY_ID"];
    delete process.env["RAZORPAY_KEY_SECRET"];
  }
});

// ── Exactly-once under retry and concurrency ─────────────────────────────────

test("a repeated callback with the same key replays, it does not convert twice", async () => {
  const slotId = await makeSlot(12, 5, 13);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);
  const key = `replay-${randomUUID()}`;
  const body = { quoteId: q.quoteId, settlement: { kind: "zero_charge" } };

  const first = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: key,
    body,
  });
  assert.equal(first.status, 201, JSON.stringify(first.json));

  const again = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: key,
    body,
  });
  assert.equal(again.status, 200, JSON.stringify(again.json));
  assert.equal(again.json.replayed, true);
  assert.equal(again.json.conversion.subscriptionId, first.json.subscription.id);

  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, q.user.id));
  assert.equal(subs.length, 1, "a replay must not mint a second subscription");
});

test("concurrent settlements of one quote produce one subscription", async () => {
  const slotId = await makeSlot(13, 5, 14);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);

  // Distinct keys on purpose: the idempotency record cannot be what saves us
  // here, so this exercises the quote claim and the unique index instead.
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      call(`/plan-drafts/${q.draftId}/convert`, {
        method: "POST",
        user: q.user,
        cookie: q.cookie,
        idempotencyKey: `race-${randomUUID()}`,
        body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
      }),
    ),
  );

  const created = results.filter((r) => r.status === 201);
  assert.equal(
    created.length,
    1,
    `exactly one settlement may convert, got ${JSON.stringify(results.map((r) => [r.status, r.json?.code]))}`,
  );
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, q.user.id));
  assert.equal(subs.length, 1);
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, q.user.id));
  assert.equal(orders.length, 1, "and exactly one billable order");
  assert.equal(await slotReserved(slotId), 1, "capacity consumed once, not four times");
});

// ── Quote validity: none of these may create anything ────────────────────────

async function assertNothingCreated(userId: string, label: string): Promise<void> {
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  assert.equal(subs.length, 0, `${label}: no subscription`);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, userId));
  assert.equal(orders.length, 0, `${label}: no order`);
}

test("an expired quote cannot convert", async () => {
  const slotId = await makeSlot(14, 5, 15);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);
  await db
    .update(planDraftQuotesTable)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(planDraftQuotesTable.id, q.quoteId));

  const res = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: `exp-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "quote_expired");
  await assertNothingCreated(q.user.id, "expired quote");
});

test("a superseded quote cannot convert", async () => {
  const slotId = await makeSlot(15, 5, 16);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);
  await db
    .update(planDraftQuotesTable)
    .set({ status: "superseded" })
    .where(eq(planDraftQuotesTable.id, q.quoteId));

  const res = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: `sup-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "quote_not_active");
  await assertNothingCreated(q.user.id, "superseded quote");
});

test("a quote whose draft has moved on cannot convert", async () => {
  const slotId = await makeSlot(16, 5, 17);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);
  await db
    .update(planDraftsTable)
    .set({ version: q.version + 5 })
    .where(eq(planDraftsTable.id, q.draftId));

  const res = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: `stale-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.code, "quote_superseded_by_edit");
  await assertNothingCreated(q.user.id, "stale-version quote");
});

test("another customer's quote is not disclosed, let alone converted", async () => {
  const slotId = await makeSlot(17, 5, 18);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);
  const stranger = await makeUser("stranger");

  const res = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: stranger,
    idempotencyKey: `theft-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(res.status, 404, "not 403 — a 403 would confirm the draft exists");
  await assertNothingCreated(stranger.id, "stranger");
  const owner = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, q.user.id));
  assert.equal(owner.length, 0, "and the owner's quote is untouched");
});

// ── Settlement rules ─────────────────────────────────────────────────────────

test("a payable quote cannot be converted by claiming zero charge", async () => {
  // The spec's sharpest rule: discount-only ₹0 without settlement evidence
  // cannot convert. The server re-derives the payable amount from the frozen
  // quote rather than believing the caller.
  const slotId = await makeSlot(18, 5, 19);
  const q = await quotedDraft(slotId);
  assert.ok(q.totalPaise > 0, "precondition: this plan costs money");

  const res = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    idempotencyKey: `free-${randomUUID()}`,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(res.status, 402, JSON.stringify(res.json));
  assert.equal(res.json.code, "settlement_required");
  await assertNothingCreated(q.user.id, "unpaid quote");
  assert.equal(await slotReserved(slotId), 1, "the quote keeps its held capacity");
});

test("a forged payment signature converts nothing", async () => {
  const slotId = await makeSlot(19, 5, 20);
  const q = await quotedDraft(slotId);
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_key";
  process.env["RAZORPAY_KEY_SECRET"] = "rzp_test_secret";
  try {
    const res = await call(`/plan-drafts/${q.draftId}/convert`, {
      method: "POST",
      user: q.user,
      cookie: q.cookie,
      idempotencyKey: `forge-${randomUUID()}`,
      body: {
        quoteId: q.quoteId,
        settlement: {
          kind: "razorpay",
          razorpayOrderId: "order_forged",
          razorpayPaymentId: "pay_forged",
          razorpaySignature: "deadbeef".repeat(8),
        },
      },
    });
    assert.equal(res.status, 400, JSON.stringify(res.json));
    assert.equal(res.json.code, "invalid_payment_signature");
    await assertNothingCreated(q.user.id, "forged signature");
  } finally {
    delete process.env["RAZORPAY_KEY_ID"];
    delete process.env["RAZORPAY_KEY_SECRET"];
  }
});

test("conversion requires an Idempotency-Key", async () => {
  const slotId = await makeSlot(20, 5, 8);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);

  const res = await call(`/plan-drafts/${q.draftId}/convert`, {
    method: "POST",
    user: q.user,
    cookie: q.cookie,
    body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
  });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.code, "idempotency_key_required");
  await assertNothingCreated(q.user.id, "no key");
});

test("PLAN_CHECKOUT_DISABLED refuses origination and creates nothing", async () => {
  const slotId = await makeSlot(21, 5, 7);
  const q = await quotedDraft(slotId);
  await makeQuoteFree(q.quoteId);

  process.env["PLAN_CHECKOUT_DISABLED"] = "1";
  try {
    const res = await call(`/plan-drafts/${q.draftId}/convert`, {
      method: "POST",
      user: q.user,
      cookie: q.cookie,
      idempotencyKey: `gated-${randomUUID()}`,
      body: { quoteId: q.quoteId, settlement: { kind: "zero_charge" } },
    });
    assert.equal(res.status, 503, JSON.stringify(res.json));
    assert.equal(res.json.code, "PLAN_CHECKOUT_TEMPORARILY_UNAVAILABLE");
    await assertNothingCreated(q.user.id, "gated");
    const [quote] = await db
      .select()
      .from(planDraftQuotesTable)
      .where(eq(planDraftQuotesTable.id, q.quoteId));
    assert.equal(quote!.status, "active", "a gated attempt must not spend the quote");
  } finally {
    delete process.env["PLAN_CHECKOUT_DISABLED"];
  }
});
