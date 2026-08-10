/**
 * Delivery scheduling, capacity and quote readiness (PR A2.3). Real Postgres.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/planDraftSchedule.test.ts
 *
 * Covers the A2.3 completion gate: unserviceable addresses are refused with
 * recovery guidance, every date and window comes from the server, capacity
 * conflicts are detected and cannot overbook, cutoffs are enforced, schedule
 * edits bump the version and supersede quotes, readiness names exactly what is
 * missing, and a stale draft cannot produce a quote.
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
  planDraftQuotesTable,
  planDraftsTable,
  slotReservationsTable,
  userAddressesTable,
  usersTable,
  type PlanDraft,
} from "@workspace/db";

import planDraftsRouter from "./planDrafts";
import planDraftLineupRouter from "./planDraftLineup";
import planDraftScheduleRouter from "./planDraftSchedule";
import { PLAN_DRAFT_TTL_MS } from "../lib/planDraftAuth";

const SERVICEABLE_PIN = "201301";
const UNSERVICEABLE_PIN = "560001"; // Bengaluru — not in the Noida cluster

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
    email: `a23-${label}-${id}@example.test`,
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

/** Publishes a slot `dayOffset` days out — comfortably past the 24h cutoff. */
async function makeSlot(dayOffset: number, capacity = 5, hour = 12): Promise<number> {
  const start = new Date();
  start.setUTCHours(hour, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + dayOffset);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const [row] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate: deriveOperationalDate(start),
      startsAt: start,
      endsAt: end,
      zone: "default",
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
}

async function call(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    cookie?: string | null;
    user?: { id: string };
  } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  if (init.user) headers["x-test-user-id"] = init.user.id;
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** A recommended-journey draft with a real generated lineup of `days` days. */
async function scheduledReadyDraft(days: number): Promise<Session> {
  const user = await makeUser("sched");
  const res = await fetch(`${baseUrl}/plan-drafts`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": user.id },
    body: JSON.stringify({ journey: "recommended", planId: "desk_fuel" }),
  });
  assert.equal(res.status, 201);
  const { draft } = (await res.json()) as { draft: PlanDraft };
  CREATED_DRAFTS.push(draft.id);
  const cookie = `plan_draft_id=${draft.id}`;
  const s: Session = { id: draft.id, cookie, version: draft.version, user };

  // Give it a lineup of exactly `days` days by writing one directly: the
  // generator's own day count follows the catalog cycle, and these tests are
  // about scheduling, not generation.
  const lineup = Array.from({ length: days }, (_, i) => ({
    deliveryDate: `2026-01-0${i + 1}`,
    deliveryWindow: null,
    addressId: null,
    slots: [],
  }));
  const [updated] = await db
    .update(planDraftsTable)
    .set({
      lineup,
      status: "lineup_ready",
      dietaryPattern: "veg",
      duration: { cycle: "weekly", renewal: "auto_renew" },
      expiresAt: new Date(Date.now() + PLAN_DRAFT_TTL_MS),
      // >1 so a test can express "one version behind" without hitting the
      // schema's min(1) floor.
      version: 2,
    })
    .where(eq(planDraftsTable.id, draft.id))
    .returning();
  assert.ok(updated);
  s.version = updated.version;
  return s;
}

test("an unserviceable address is refused with a reason and recovery options", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, UNSERVICEABLE_PIN);

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  assert.equal(opts.status, 200);
  assert.equal(opts.json.serviceable, false);
  assert.equal(opts.json.reason, "pincode_not_serviceable");
  assert.ok(opts.json.message.includes(UNSERVICEABLE_PIN));
  assert.ok(
    opts.json.recovery.length > 0,
    "a dead end without recovery options is the defect this closes",
  );
  assert.deepEqual(opts.json.dates, []);
});

test("eligible dates and windows come from the server, past the cutoff only", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const soonId = await makeSlot(3, 5, 9);
  // A slot inside the 24h cutoff must never be offered.
  const tooSoon = new Date(Date.now() + 60 * 60 * 1000);
  const [inside] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate: deriveOperationalDate(tooSoon),
      startsAt: tooSoon,
      endsAt: new Date(tooSoon.getTime() + 3600_000),
      zone: "default",
      capacity: 5,
    })
    .returning();
  assert.ok(inside);
  CREATED_SLOTS.push(inside.id);

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  assert.equal(opts.status, 200);
  assert.equal(opts.json.serviceable, true);

  const offered = opts.json.dates.flatMap((d: any) =>
    d.windows.map((w: any) => w.slotId),
  );
  assert.ok(offered.includes(soonId), "a slot past the cutoff is offered");
  assert.equal(
    offered.includes(inside.id),
    false,
    "a slot inside the 24h cutoff must not be offered",
  );
  assert.equal(opts.json.requiredDayCount, 1);
});

test("a full slot is not offered", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const fullId = await makeSlot(4, 1, 10);
  await db
    .update(deliverySlotsTable)
    .set({ reservedCount: 1 })
    .where(eq(deliverySlotsTable.id, fullId));

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  const offered = opts.json.dates.flatMap((d: any) =>
    d.windows.map((w: any) => w.slotId),
  );
  assert.equal(offered.includes(fullId), false);
});

test("saving a schedule assigns dates, bumps the version, and needs a server-offered slot", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const slotId = await makeSlot(5, 5, 11);

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  const window = opts.json.dates
    .flatMap((d: any) => d.windows.map((w: any) => ({ ...w, date: d.deliveryDate })))
    .find((w: any) => w.slotId === slotId);
  assert.ok(window, "the slot we published should be offered");

  const saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [
        {
          deliveryDate: window.date,
          deliveryWindow: window.deliveryWindow,
          slotId,
        },
      ],
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.ok(saved.json.draft.version > s.version, "a schedule edit bumps the version");
  assert.equal(saved.json.draft.lineup[0].deliveryWindow, window.deliveryWindow);
  assert.equal(saved.json.draft.lineup[0].addressId, addressId);
  assert.equal(saved.json.draft.deliverySchedule.addressId, addressId);
});

test("a made-up date or window is refused — the client cannot invent one", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  await makeSlot(6, 5, 13);

  const bogus = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [
        { deliveryDate: "2030-12-25", deliveryWindow: "09:00-10:00", slotId: 999999 },
      ],
    },
  });
  assert.equal(bogus.status, 422);
  assert.equal(bogus.json.code, "schedule_invalid");
  assert.ok(
    bogus.json.issues.some((i: any) => i.code === "date_not_eligible"),
  );
});

test("two plan days cannot share one delivery slot", async () => {
  const s = await scheduledReadyDraft(2);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const slotId = await makeSlot(7, 5, 14);

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  const w = opts.json.dates
    .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
    .find((x: any) => x.slotId === slotId);
  assert.ok(w);

  const dup = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [
        { deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId },
        { deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId },
      ],
    },
  });
  assert.equal(dup.status, 422);
  assert.ok(
    dup.json.issues.some((i: any) => i.code === "duplicate_delivery_slot"),
    "double-booking one slot would halve the deliveries the customer pays for",
  );
});

test("readiness names exactly what is missing rather than failing generically", async () => {
  const s = await scheduledReadyDraft(1);

  const readiness = await call(`/plan-drafts/${s.id}/quote-readiness`, {
    cookie: s.cookie,
    user: s.user,
  });
  assert.equal(readiness.status, 200);
  assert.equal(readiness.json.ready, false);
  const codes = readiness.json.issues.map((i: any) => i.code);
  assert.ok(codes.includes("schedule_incomplete"));
  assert.ok(codes.includes("address_unserviceable"));
  for (const issue of readiness.json.issues) {
    assert.ok(issue.message.length > 0, "every blocker must be explainable");
  }
});

test("a custom plan is honestly reported as un-quotable rather than priced at a made-up number", async () => {
  const user = await makeUser("custom-quote");
  const res = await fetch(`${baseUrl}/plan-drafts`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": user.id },
    body: JSON.stringify({ journey: "custom" }),
  });
  const { draft } = (await res.json()) as { draft: PlanDraft };
  CREATED_DRAFTS.push(draft.id);

  const readiness = await call(`/plan-drafts/${draft.id}/quote-readiness`, {
    cookie: `plan_draft_id=${draft.id}`,
    user,
  });
  assert.ok(
    readiness.json.issues.some((i: any) => i.code === "pricing_unavailable"),
    "Journey 4 has no pricing model; inventing one is the defect class this series removes",
  );
});

test("a fully configured plan quotes from the catalog, holds capacity, and moves to quoted", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const slotId = await makeSlot(8, 5, 15);

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  const w = opts.json.dates
    .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
    .find((x: any) => x.slotId === slotId);
  assert.ok(w);

  const saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [{ deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId }],
    },
  });
  assert.equal(saved.status, 200);
  s.version = saved.json.draft.version;

  const ready = await call(`/plan-drafts/${s.id}/quote-readiness`, {
    cookie: s.cookie,
    user: s.user,
  });
  assert.equal(ready.json.ready, true, JSON.stringify(ready.json.issues));

  const quoted = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(quoted.status, 201, JSON.stringify(quoted.json));
  assert.ok(quoted.json.quote.totalPaise > 0, "the catalog priced it");
  assert.equal(quoted.json.quote.planDraftVersion, s.version);
  assert.equal(quoted.json.draft.status, "quoted");

  // The quote holds real capacity.
  const [slot] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, slotId));
  assert.equal(slot?.reservedCount, 1, "quoting reserves the slot it scheduled");
});

test("a stale draft version cannot produce a quote", async () => {
  const s = await scheduledReadyDraft(1);
  const stale = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version - 1 },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, "stale_version");
});

test("rescheduling supersedes the active quote and gives its capacity back", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const firstSlot = await makeSlot(9, 5, 16);
  const secondSlot = await makeSlot(10, 5, 17);

  const pick = async (slotId: number) => {
    const opts = await call(
      `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
      { cookie: s.cookie, user: s.user },
    );
    const w = opts.json.dates
      .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
      .find((x: any) => x.slotId === slotId);
    assert.ok(w, `slot ${slotId} should be offered`);
    return w;
  };

  const w1 = await pick(firstSlot);
  let saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [{ deliveryDate: w1.date, deliveryWindow: w1.deliveryWindow, slotId: firstSlot }],
    },
  });
  s.version = saved.json.draft.version;

  const quoted = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(quoted.status, 201, JSON.stringify(quoted.json));
  s.version = quoted.json.draft.version;

  // Reschedule onto a different slot.
  const w2 = await pick(secondSlot);
  saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [{ deliveryDate: w2.date, deliveryWindow: w2.deliveryWindow, slotId: secondSlot }],
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.equal(saved.json.supersededQuotes, 1, "the old quote is superseded");

  const [old] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, firstSlot));
  assert.equal(
    old?.reservedCount,
    0,
    "capacity held by a superseded quote must be released, not leaked",
  );
});

test("concurrent quotes cannot overbook the last unit of capacity", async () => {
  const slotId = await makeSlot(11, 1, 18); // capacity 1

  const sessions: Session[] = [];
  for (let i = 0; i < 2; i++) {
    const s = await scheduledReadyDraft(1);
    const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
    const opts = await call(
      `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
      { cookie: s.cookie, user: s.user },
    );
    const w = opts.json.dates
      .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
      .find((x: any) => x.slotId === slotId);
    assert.ok(w, "the shared slot should still be offered");
    const saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
      method: "PUT",
      cookie: s.cookie,
      user: s.user,
      body: {
        version: s.version,
        addressId,
        assignments: [{ deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId }],
      },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.json));
    s.version = saved.json.draft.version;
    sessions.push(s);
  }

  const results = await Promise.all(
    sessions.map((s) =>
      call(`/plan-drafts/${s.id}/quote`, {
        method: "POST",
        cookie: s.cookie,
        user: s.user,
        body: { version: s.version },
      }),
    ),
  );

  const issued = results.filter((r) => r.status === 201);
  const refused = results.filter((r) => r.status !== 201);
  assert.equal(
    issued.length,
    1,
    `exactly one quote may take the last unit, got ${JSON.stringify(results.map((r) => [r.status, r.json?.code]))}`,
  );
  assert.equal(refused.length, 1);
  // The loser is refused for CAPACITY either way, by whichever guard sees it
  // first: the readiness re-check (422, capacity_unavailable among its issues)
  // or the conditional reservation itself (409, capacity_unavailable). Both are
  // correct; asserting only one would pin an implementation detail.
  const loser = refused[0]!;
  const capacityRefusal =
    loser.json.code === "capacity_unavailable" ||
    (loser.json.code === "not_ready_for_quote" &&
      loser.json.issues.some((i: any) => i.code === "capacity_unavailable"));
  assert.ok(
    capacityRefusal,
    `the loser must be refused for capacity, got ${JSON.stringify(loser.json)}`,
  );

  const [slot] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, slotId));
  assert.equal(slot?.reservedCount, 1, "capacity must never exceed its ceiling");
});

test("an expired quote releases its capacity", async () => {
  const s = await scheduledReadyDraft(1);
  const addressId = await makeAddress(s.user.id, SERVICEABLE_PIN);
  const slotId = await makeSlot(12, 5, 19);

  const opts = await call(
    `/plan-drafts/${s.id}/delivery-options?addressId=${addressId}`,
    { cookie: s.cookie, user: s.user },
  );
  const w = opts.json.dates
    .flatMap((d: any) => d.windows.map((x: any) => ({ ...x, date: d.deliveryDate })))
    .find((x: any) => x.slotId === slotId);
  assert.ok(w);
  const saved = await call(`/plan-drafts/${s.id}/delivery-schedule`, {
    method: "PUT",
    cookie: s.cookie,
    user: s.user,
    body: {
      version: s.version,
      addressId,
      assignments: [{ deliveryDate: w.date, deliveryWindow: w.deliveryWindow, slotId }],
    },
  });
  s.version = saved.json.draft.version;
  const quoted = await call(`/plan-drafts/${s.id}/quote`, {
    method: "POST",
    cookie: s.cookie,
    user: s.user,
    body: { version: s.version },
  });
  assert.equal(quoted.status, 201, JSON.stringify(quoted.json));

  // Age the quote out, then run the sweep.
  await db
    .update(planDraftQuotesTable)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(planDraftQuotesTable.id, quoted.json.quote.id));

  const { expireLapsedQuotes } = await import("../lib/planDraftSchedule");
  const expired = await expireLapsedQuotes();
  assert.ok(expired >= 1);

  const [slot] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, slotId));
  assert.equal(
    slot?.reservedCount,
    0,
    "a browsing customer must not hold capacity forever",
  );
});
