/**
 * Quote and reservation lifecycle (PR A2.3a). Real Postgres.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/planDraftQuoteLifecycle.test.ts
 *
 * These are the follow-up checks the A2.3 review made a condition of closing
 * the slice, plus a regression for the overbooking defect found while wiring
 * them up. Every one of them is about a number that must not drift: how many
 * units of kitchen capacity are held, how many times one reservation may give
 * its unit back, and how many orders one quote may become.
 *
 *   1. Capacity release is idempotent, and consumed capacity is unreleasable.
 *   2. Quote creation is idempotent, and cannot double-reserve under a race.
 *   3. Expiry is enforced from server time, not from the sweeper having run.
 *   4. The 24h cutoff is exact at the boundary and timezone-independent.
 *   5. A catalog price change never mutates an already-issued quote.
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
  planDraftQuotesTable,
  planDraftsTable,
  slotReservationsTable,
  userAddressesTable,
  usersTable,
  type PlanDraft,
} from "@workspace/db";
import { PLAN_CATALOG, PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

import planDraftsRouter from "./planDrafts";
import planDraftLineupRouter from "./planDraftLineup";
import planDraftScheduleRouter from "./planDraftSchedule";
import { PLAN_DRAFT_TTL_MS } from "../lib/planDraftAuth";
import {
  DELIVERY_CUTOFF_MS,
  DELIVERY_OPERATIONAL_TZ,
  consumeQuote,
  eligibleDates,
  expireLapsedQuotes,
  releaseSlotsForQuote,
  reserveSlotsForQuote,
  supersedeActiveQuotes,
  windowLabel,
} from "../lib/planDraftSchedule";

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
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_SLOTS.length > 0) {
    await db
      .delete(slotReservationsTable)
      .where(inArray(slotReservationsTable.slotId, CREATED_SLOTS));
  }
  if (CREATED_DRAFTS.length > 0) {
    await db
      .delete(planDraftQuotesTable)
      .where(inArray(planDraftQuotesTable.planDraftId, CREATED_DRAFTS));
    await db.delete(planDraftsTable).where(inArray(planDraftsTable.id, CREATED_DRAFTS));
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
    email: `a23a-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USERS.push(id);
  const u = { id };
  USER_REGISTRY.set(id, u);
  return u;
}

async function makeAddress(userId: string, pincode: string): Promise<number> {
  const [row] = await db
    .insert(userAddressesTable)
    .values({
      userId,
      label: "Home",
      line1: "1 Test Street",
      city: "Noida",
      pincode,
      phone: "9999999999",
    })
    .returning();
  assert.ok(row);
  return row.id;
}

/** Publishes a slot `dayOffset` days out — comfortably past the 24h cutoff.
 *  `zone` is per-test so concurrent suites cannot see each other's slots. */
async function makeSlot(
  dayOffset: number,
  capacity = 5,
  hour = 12,
  zone = "default",
): Promise<number> {
  const start = new Date();
  start.setUTCHours(hour, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + dayOffset);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const [row] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate: start.toISOString().slice(0, 10),
      startsAt: start,
      endsAt: end,
      zone,
      capacity,
      reservedCount: 0,
    })
    .returning();
  assert.ok(row);
  CREATED_SLOTS.push(row.id);
  return row.id;
}

interface Session {
  id: string;
  cookie: string;
  version: number;
  user: { id: string };
  addressId: number;
}

async function call(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    cookie?: string | null;
    user?: { id: string };
    idempotencyKey?: string;
  } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  if (init.user) headers["x-test-user-id"] = init.user.id;
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** A recommended-journey draft, scheduled onto `slotId`, ready to quote. */
async function quotableDraft(slotId: number): Promise<Session> {
  const user = await makeUser("q");
  const res = await fetch(`${baseUrl}/plan-drafts`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": user.id },
    body: JSON.stringify({ journey: "recommended", planId: "desk_fuel" }),
  });
  assert.equal(res.status, 201);
  const { draft } = (await res.json()) as { draft: PlanDraft };
  CREATED_DRAFTS.push(draft.id);
  const cookie = `plan_draft_id=${draft.id}`;
  const addressId = await makeAddress(user.id, SERVICEABLE_PIN);

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

  const s: Session = { id: draft.id, cookie, version: 2, user, addressId };

  const opts = await call(`/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`, {
    cookie,
    user,
  });
  assert.equal(opts.status, 200, JSON.stringify(opts.json));
  const w = opts.json.dates
    .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
    .find((x: any) => x.slotId === slotId);
  assert.ok(w, `slot ${slotId} should be offered`);

  const saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie,
    user,
    body: {
      version: s.version,
      addressId,
      assignments: [
        { deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId },
      ],
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  s.version = saved.json.draft.version;
  return s;
}

async function slotState(slotId: number): Promise<{ reserved: number; capacity: number }> {
  const [row] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, slotId));
  assert.ok(row);
  return { reserved: row.reservedCount, capacity: row.capacity };
}

async function reservationStatuses(slotId: number): Promise<string[]> {
  const rows = await db
    .select({ status: slotReservationsTable.status })
    .from(slotReservationsTable)
    .where(eq(slotReservationsTable.slotId, slotId));
  return rows.map((r) => r.status).sort();
}

// ── Regression: DEFECT-PLAN-CAPACITY-002 ─────────────────────────────────────

test("a quote is never issued holding less capacity than the days it sells", async () => {
  // Capacity 1, two customers, both scheduled onto it. Before the fix the
  // loser's slot lookup went through the OFFER list, which hides a full slot —
  // so it resolved zero slot ids, reserved nothing, and was handed a 201 for a
  // delivery with no capacity behind it.
  const slotId = await makeSlot(11, 1, 18);
  const a = await quotableDraft(slotId);
  const b = await quotableDraft(slotId);

  const results = await Promise.all(
    [a, b].map((s) =>
      call(`/plan-drafts/${s.id}/quote`, {
        method: "POST",
        cookie: s.cookie,
        user: s.user,
        body: { version: s.version },
      }),
    ),
  );

  const issued = results.filter((r) => r.status === 201);
  assert.equal(
    issued.length,
    1,
    `exactly one quote may take the last unit, got ${JSON.stringify(results.map((r) => [r.status, r.json?.code]))}`,
  );

  // The half the old test never checked, and the half that was actually broken.
  const { reserved, capacity } = await slotState(slotId);
  assert.equal(reserved, 1, "the winner must hold exactly one unit");
  assert.ok(reserved <= capacity, "capacity must never be oversold");

  const winner = issued[0]!;
  const held = await db
    .select()
    .from(slotReservationsTable)
    .where(eq(slotReservationsTable.planDraftQuoteId, winner.json.quote.id));
  assert.equal(
    held.length,
    winner.json.quote.schedule.length,
    "an issued quote must hold one reservation per day it sells",
  );
});

// ── Review check 1: capacity release is idempotent ───────────────────────────

test("releasing the same reservation twice decrements capacity once", async () => {
  const slotId = await makeSlot(12, 3, 9);
  const quoteId = `rel-twice-${slotId}`;
  await db.transaction(async (tx) => {
    await reserveSlotsForQuote(tx, quoteId, [slotId], null);
  });
  assert.equal((await slotState(slotId)).reserved, 1);

  await db.transaction((tx) => releaseSlotsForQuote(tx, quoteId));
  const afterFirst = await slotState(slotId);
  assert.equal(afterFirst.reserved, 0, "the first release gives the unit back");

  const claimedAgain = await db.transaction((tx) => releaseSlotsForQuote(tx, quoteId));
  assert.equal(claimedAgain, 0, "a second release must claim nothing");
  assert.equal(
    (await slotState(slotId)).reserved,
    0,
    "a repeated release must not drive the counter below the truth",
  );
  assert.deepEqual(await reservationStatuses(slotId), ["released"]);
});

test("concurrent releases of one reservation decrement capacity exactly once", async () => {
  // Expiry sweeper, draft edit, reschedule, supersession and a manual refresh
  // can all reach the same reservation at once. Five racing releasers.
  const slotId = await makeSlot(13, 5, 10);
  const quoteId = `rel-race-${slotId}`;
  await db.transaction(async (tx) => {
    await reserveSlotsForQuote(tx, quoteId, [slotId], null);
  });
  assert.equal((await slotState(slotId)).reserved, 1);

  const claims = await Promise.all(
    Array.from({ length: 5 }, () =>
      db.transaction((tx) => releaseSlotsForQuote(tx, quoteId)),
    ),
  );

  assert.equal(
    claims.reduce((a, b) => a + b, 0),
    1,
    "exactly one of the racing releasers may claim the reservation",
  );
  assert.equal((await slotState(slotId)).reserved, 0);
});

test("supersession and expiry racing the same quote release it once", async () => {
  const slotId = await makeSlot(14, 5, 11);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  assert.equal((await slotState(slotId)).reserved, 1);

  // Force the quote past its TTL so the sweeper is eligible too, then run both
  // paths concurrently.
  await db
    .update(planDraftQuotesTable)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(planDraftQuotesTable.id, issue.json.quote.id));

  const [superseded, expired] = await Promise.all([
    supersedeActiveQuotes(s.id),
    expireLapsedQuotes(new Date()),
  ]);

  assert.equal(
    superseded + expired,
    1,
    "only one of supersede/expire may claim the quote",
  );
  assert.equal(
    (await slotState(slotId)).reserved,
    0,
    "the unit comes back exactly once, whichever path won",
  );
  assert.deepEqual(await reservationStatuses(slotId), ["released"]);
});

test("a consumed reservation can never be released", async () => {
  // The dangerous one: once an order owns the capacity, a sweeper arriving late
  // must not hand it back, or the kitchen resells a slot it has already sold.
  const slotId = await makeSlot(15, 2, 13);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  const quoteId = issue.json.quote.id as string;

  const consumed = await consumeQuote(quoteId);
  assert.equal(consumed.ok, true);
  assert.equal(consumed.reservationsConsumed, 1);
  assert.equal(
    (await slotState(slotId)).reserved,
    1,
    "consumption does NOT give capacity back — it changes owner",
  );

  // Now throw every release path at it.
  const released = await db.transaction((tx) => releaseSlotsForQuote(tx, quoteId));
  const sweptSupersede = await supersedeActiveQuotes(s.id);
  await db
    .update(planDraftQuotesTable)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(planDraftQuotesTable.id, quoteId));
  const sweptExpire = await expireLapsedQuotes(new Date());

  assert.equal(released, 0, "a consumed reservation is invisible to release");
  assert.equal(sweptSupersede, 0, "a consumed quote is not supersedable");
  assert.equal(sweptExpire, 0, "a consumed quote is not expirable");
  assert.equal(
    (await slotState(slotId)).reserved,
    1,
    "the order keeps its capacity",
  );
  assert.deepEqual(await reservationStatuses(slotId), ["consumed"]);
});

// ── Review check 2: quote creation is idempotent ─────────────────────────────

test("a retried quote request with the same key returns the quote already issued", async () => {
  const slotId = await makeSlot(16, 5, 14);
  const s = await quotableDraft(slotId);
  const key = `idem-${randomUUID()}`;

  const first = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    idempotencyKey: key,
    body: { version: s.version },
  });
  assert.equal(first.status, 201, JSON.stringify(first.json));
  assert.equal(first.json.replayed, false);

  const retry = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    idempotencyKey: key,
    body: { version: s.version },
  });
  assert.equal(retry.status, 200, JSON.stringify(retry.json));
  assert.equal(retry.json.replayed, true);
  assert.equal(retry.json.quote.id, first.json.quote.id, "same quote, not a new one");
  assert.equal(
    (await slotState(slotId)).reserved,
    1,
    "a retry must not reserve a second unit",
  );

  const quotes = await db
    .select()
    .from(planDraftQuotesTable)
    .where(eq(planDraftQuotesTable.planDraftId, s.id));
  assert.equal(quotes.length, 1, "a retry must not create a second quote row");
});

test("concurrent quote requests with the same key reserve exactly one unit", async () => {
  const slotId = await makeSlot(17, 5, 15);
  const s = await quotableDraft(slotId);
  const key = `idem-race-${randomUUID()}`;

  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      call(`/plan-drafts/${s.id}/quote`, {
        method: "POST",
        cookie: s.cookie,
        user: s.user,
        idempotencyKey: key,
        body: { version: s.version },
      }),
    ),
  );

  const ok = results.filter((r) => r.status === 201 || r.status === 200);
  assert.ok(ok.length >= 1, `at least one must succeed: ${JSON.stringify(results.map((r) => [r.status, r.json?.code]))}`);
  const created = results.filter((r) => r.status === 201);
  assert.equal(created.length, 1, "only one request may CREATE the quote");

  const ids = new Set(ok.map((r) => r.json.quote.id));
  assert.equal(ids.size, 1, "every successful response names the same quote");
  assert.equal(
    (await slotState(slotId)).reserved,
    1,
    "four concurrent retries hold one unit between them",
  );

  const active = await db
    .select()
    .from(planDraftQuotesTable)
    .where(eq(planDraftQuotesTable.planDraftId, s.id));
  assert.equal(active.filter((q) => q.status === "active").length, 1);
});

test("the same key cannot be reused once the draft has moved on", async () => {
  const slotId = await makeSlot(18, 5, 16);
  const s = await quotableDraft(slotId);
  const key = `idem-stale-${randomUUID()}`;

  const first = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    idempotencyKey: key,
    body: { version: s.version },
  });
  assert.equal(first.status, 201, JSON.stringify(first.json));

  // The customer edits: the draft version moves past the one the quote priced.
  await db
    .update(planDraftsTable)
    .set({ version: s.version + 1 })
    .where(eq(planDraftsTable.id, s.id));

  const replay = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    idempotencyKey: key,
    body: { version: s.version + 1 },
  });
  assert.equal(replay.status, 409, JSON.stringify(replay.json));
  assert.equal(replay.json.code, "idempotency_key_reused");
});

test("a different key on an unchanged draft supersedes and re-reserves, net one unit", async () => {
  // Documented policy: a fresh key is a fresh offer. The old quote is
  // superseded and its capacity released in the same transaction that reserves
  // for the new one, so the draft never holds two quotes' worth of capacity.
  const slotId = await makeSlot(19, 5, 17);
  const s = await quotableDraft(slotId);

  const first = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    idempotencyKey: `k1-${randomUUID()}`,
    body: { version: s.version },
  });
  assert.equal(first.status, 201, JSON.stringify(first.json));

  const second = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    idempotencyKey: `k2-${randomUUID()}`,
    body: { version: s.version },
  });
  assert.equal(second.status, 201, JSON.stringify(second.json));
  assert.notEqual(second.json.quote.id, first.json.quote.id);

  assert.equal(
    (await slotState(slotId)).reserved,
    1,
    "two quotes in sequence still hold exactly one unit",
  );
  const rows = await db
    .select()
    .from(planDraftQuotesTable)
    .where(eq(planDraftQuotesTable.planDraftId, s.id));
  assert.equal(rows.filter((q) => q.status === "active").length, 1);
  assert.equal(rows.filter((q) => q.status === "superseded").length, 1);
});

test("a freshly issued quote does not report itself stale", async () => {
  // Issuing used to bump the draft version as a side effect of the status
  // write, so `stale` — defined as "the draft moved past the version this quote
  // priced" — was true the instant the quote existed, and the customer would be
  // told to re-check a plan they had just confirmed.
  const slotId = await makeSlot(25, 5, 3);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  assert.equal(issue.json.draft.status, "quoted");
  assert.equal(
    issue.json.draft.version,
    s.version,
    "issuing a quote is not an edit to the plan it priced",
  );

  const readiness = await call(`/plan-drafts/${s.id}/quote-readiness`, {
    cookie: s.cookie,
    user: s.user,
  });
  assert.equal(readiness.status, 200);
  assert.equal(readiness.json.activeQuote.id, issue.json.quote.id);
  assert.equal(readiness.json.activeQuote.stale, false);
});

// ── Review check 3: expiry has a real execution path ─────────────────────────

test("an expired quote cannot be consumed even before the sweeper runs", async () => {
  const slotId = await makeSlot(20, 5, 8);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  const quoteId = issue.json.quote.id as string;

  // Age it out WITHOUT running the sweeper: the row still says `active`.
  await db
    .update(planDraftQuotesTable)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(planDraftQuotesTable.id, quoteId));
  const [stillActive] = await db
    .select()
    .from(planDraftQuotesTable)
    .where(eq(planDraftQuotesTable.id, quoteId));
  assert.equal(stillActive!.status, "active", "precondition: sweeper has not run");

  const consumed = await consumeQuote(quoteId);
  assert.equal(consumed.ok, false, "server time, not row status, decides payability");
  assert.equal(consumed.refusal, "expired");

  // And the sweeper still gives the capacity back, exactly once.
  assert.equal(await expireLapsedQuotes(new Date()), 1);
  assert.equal((await slotState(slotId)).reserved, 0);
  assert.equal(await expireLapsedQuotes(new Date()), 0, "sweeping twice is a no-op");
  assert.equal((await slotState(slotId)).reserved, 0);
});

test("one quote can be consumed only once, however many callbacks arrive", async () => {
  const slotId = await makeSlot(21, 5, 7);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  const quoteId = issue.json.quote.id as string;

  const attempts = await Promise.all(
    Array.from({ length: 4 }, () => consumeQuote(quoteId)),
  );
  assert.equal(
    attempts.filter((a) => a.ok).length,
    1,
    "a repeated payment callback must not settle twice",
  );
  assert.ok(attempts.filter((a) => !a.ok).every((a) => a.refusal === "not_active"));
  assert.equal((await slotState(slotId)).reserved, 1);
});

test("a superseded quote cannot be consumed", async () => {
  const slotId = await makeSlot(22, 5, 6);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  const quoteId = issue.json.quote.id as string;

  assert.equal(await supersedeActiveQuotes(s.id), 1);
  const consumed = await consumeQuote(quoteId);
  assert.equal(consumed.ok, false);
  assert.equal(consumed.refusal, "not_active");
  assert.equal((await slotState(slotId)).reserved, 0);
});

// ── Review check 4: the cutoff is exact, and timezone-independent ────────────

test("the 24h cutoff is inclusive at the boundary and exact to the second", async () => {
  const zone = `cutoff-${randomUUID().slice(0, 8)}`;
  const now = new Date("2026-09-01T12:00:00.000Z");
  const at = new Date(now.getTime() + DELIVERY_CUTOFF_MS);
  const oneSecondInside = new Date(at.getTime() - 1000);
  const oneSecondOutside = new Date(at.getTime() + 1000);

  const ids: Record<string, number> = {};
  for (const [label, startsAt] of [
    ["inside", oneSecondInside],
    ["boundary", at],
    ["outside", oneSecondOutside],
  ] as const) {
    const [row] = await db
      .insert(deliverySlotsTable)
      .values({
        slotDate: startsAt.toISOString().slice(0, 10),
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3600_000),
        zone,
        capacity: 5,
        reservedCount: 0,
      })
      .returning();
    assert.ok(row);
    CREATED_SLOTS.push(row.id);
    ids[label] = row.id;
  }

  const offered = new Set(
    (await eligibleDates(zone, { now })).flatMap((d) => d.windows.map((w) => w.slotId)),
  );
  assert.ok(
    !offered.has(ids["inside"]!),
    "one second inside the cutoff must not be bookable",
  );
  assert.ok(
    offered.has(ids["boundary"]!),
    "exactly 24h out IS bookable — the cutoff is inclusive, and saying so is the point",
  );
  assert.ok(offered.has(ids["outside"]!), "one second outside the cutoff is bookable");
});

test("eligibility is decided by absolute instants, not by the process timezone", async () => {
  const zone = `tz-${randomUUID().slice(0, 8)}`;
  const now = new Date("2026-09-01T12:00:00.000Z");
  const startsAt = new Date(now.getTime() + DELIVERY_CUTOFF_MS + 3600_000);
  const [row] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate: startsAt.toISOString().slice(0, 10),
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600_000),
      zone,
      capacity: 5,
      reservedCount: 0,
    })
    .returning();
  assert.ok(row);
  CREATED_SLOTS.push(row.id);

  const original = process.env["TZ"];
  const seen: Record<string, boolean> = {};
  const labels: Record<string, string> = {};
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"]) {
      process.env["TZ"] = tz;
      const dates = await eligibleDates(zone, { now });
      seen[tz] = dates.some((d) => d.windows.some((w) => w.slotId === row.id));
      labels[tz] = windowLabel(row);
    }
  } finally {
    if (original === undefined) delete process.env["TZ"];
    else process.env["TZ"] = original;
  }

  assert.ok(
    Object.values(seen).every(Boolean),
    `the same slot must be eligible under every process timezone, got ${JSON.stringify(seen)}`,
  );
  assert.equal(
    new Set(Object.values(labels)).size,
    1,
    `the window label is pinned to ${DELIVERY_OPERATIONAL_TZ}, not to TZ: ${JSON.stringify(labels)}`,
  );
});

test("window labels are rendered in the one operational timezone", async () => {
  // 06:30 UTC is 12:00 IST. A customer in Noida is told noon, not half six.
  const startsAt = new Date("2026-09-05T06:30:00.000Z");
  const label = windowLabel({ startsAt, endsAt: new Date("2026-09-05T08:30:00.000Z") });
  assert.equal(label, "12:00-14:00");
});

// ── Review check 5: catalog drift never mutates an issued quote ──────────────

test("a catalog price change does not move an already-issued quote", async () => {
  const slotId = await makeSlot(23, 5, 5);
  const s = await quotableDraft(slotId);
  const issue = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(issue.status, 201, JSON.stringify(issue.json));
  const quotedTotal = issue.json.quote.totalPaise as number;
  assert.ok(quotedTotal > 0);

  const table = PLAN_PRICE_TABLE as unknown as Record<
    string,
    Record<string, { weeklyTotalPaise?: number | null; perMealPaise: number }>
  >;
  const entry = table["desk_fuel"]!["veg"]!;
  const originalWeekly = entry.weeklyTotalPaise;
  const originalPerMeal = entry.perMealPaise;
  try {
    // Ops re-prices the plan while the customer is at checkout.
    if (originalWeekly != null) entry.weeklyTotalPaise = originalWeekly + 50_000;
    entry.perMealPaise = originalPerMeal + 5_000;

    const readiness = await call(`/plan-drafts/${s.id}/quote-readiness`, {
      cookie: s.cookie,
      user: s.user,
    });
    assert.equal(readiness.status, 200);
    assert.equal(
      readiness.json.activeQuote.totalPaise,
      quotedTotal,
      "the offer the customer was shown is honoured for its TTL — a quote is a snapshot, not a live query",
    );

    const [stored] = await db
      .select()
      .from(planDraftQuotesTable)
      .where(eq(planDraftQuotesTable.id, issue.json.quote.id));
    assert.equal(stored!.totalPaise, quotedTotal);
  } finally {
    entry.weeklyTotalPaise = originalWeekly;
    entry.perMealPaise = originalPerMeal;
  }
});

test("a plan withdrawn from the catalog cannot be quoted afresh", async () => {
  const slotId = await makeSlot(24, 5, 4);
  const s = await quotableDraft(slotId);

  const catalog = PLAN_CATALOG as unknown as Record<string, unknown>;
  const withdrawn = catalog["desk_fuel"];
  try {
    delete catalog["desk_fuel"];

    const readiness = await call(`/plan-drafts/${s.id}/quote-readiness`, {
      cookie: s.cookie,
      user: s.user,
    });
    assert.equal(readiness.status, 200);
    assert.equal(readiness.json.ready, false);
    assert.ok(
      readiness.json.issues.some((i: any) => i.code === "pricing_unavailable"),
      `a plan with no catalog entry has no price: ${JSON.stringify(readiness.json.issues)}`,
    );

    const issue = await call(`/plan-drafts/${s.id}/quote`, {
      method: "POST",
      cookie: s.cookie,
      user: s.user,
      body: { version: s.version },
    });
    assert.equal(issue.status, 422, JSON.stringify(issue.json));
    assert.equal(issue.json.code, "not_ready_for_quote");
    assert.equal(
      (await slotState(slotId)).reserved,
      0,
      "a refused quote reserves nothing",
    );
  } finally {
    catalog["desk_fuel"] = withdrawn;
  }
});
