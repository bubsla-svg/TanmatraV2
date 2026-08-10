/**
 * Rate-limit contract for the plan-draft family (PR A2.2H).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/planDraftRateLimit.test.ts
 *
 * Asserts the two things that actually matter about a 429 here:
 *   1. It is TYPED and carries Retry-After, so a client can tell which budget
 *      it exhausted and when to come back — not a bare "rate_limited".
 *   2. It has NO side effect. A throttled generate must not have taken a
 *      generation claim, and a throttled shuffle must not have touched the
 *      lineup. The limiter runs before the handler precisely so that holds,
 *      and this pins it.
 *
 * Limits are set per-test through the same env vars an operator would use,
 * which is also how this file proves they are honoured at runtime rather than
 * frozen at import.
 */

import assert from "node:assert/strict";
import { test, after, before, beforeEach } from "node:test";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { inArray } from "drizzle-orm";
import { db, planDraftsTable, type PlanDraft } from "@workspace/db";

import planDraftsRouter from "./planDrafts";
import planDraftLineupRouter from "./planDraftLineup";

let server: http.Server;
let baseUrl = "";
const CREATED_DRAFT_IDS: string[] = [];

/** Generous everywhere by default; each test tightens only the one budget it
 *  is exercising, so no test can throttle another's setup. */
function relaxAllLimits(): void {
  process.env["PLAN_DRAFT_CREATE_PER_MIN"] = "100000";
  process.env["PLAN_DRAFT_MUTATE_PER_MIN"] = "100000";
  process.env["PLAN_GENERATION_PER_MIN"] = "100000";
  process.env["PLAN_SHUFFLE_PER_MIN"] = "100000";
  process.env["PLAN_DRAFT_READ_PER_MIN"] = "100000";
}

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: unknown; isAuthenticated: () => boolean };
    r.isAuthenticated = () => false;
    next();
  });
  app.use(planDraftsRouter);
  app.use(planDraftLineupRouter);
  return app;
}

before(async () => {
  relaxAllLimits();
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => relaxAllLimits());

after(async () => {
  relaxAllLimits();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_DRAFT_IDS.length > 0) {
    await db
      .delete(planDraftsTable)
      .where(inArray(planDraftsTable.id, CREATED_DRAFT_IDS));
  }
});

function cookieFrom(res: globalThis.Response): string | null {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    if (pair?.startsWith("plan_draft_id=")) return pair;
  }
  return null;
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string | null } = {},
): Promise<{ status: number; json: any; retryAfter: string | null }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  return {
    status: res.status,
    json: text ? JSON.parse(text) : null,
    retryAfter: res.headers.get("retry-after"),
  };
}

interface Session {
  id: string;
  cookie: string;
  version: number;
}

async function createDraft(): Promise<Session> {
  const res = await fetch(`${baseUrl}/plan-drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ journey: "custom" }),
  });
  assert.equal(res.status, 201);
  const cookie = cookieFrom(res);
  assert.ok(cookie);
  const { draft } = (await res.json()) as { draft: PlanDraft };
  CREATED_DRAFT_IDS.push(draft.id);
  return { id: draft.id, cookie, version: draft.version };
}

async function patch(s: Session, body: Record<string, unknown>): Promise<PlanDraft> {
  const { status, json } = await call(`/plan-drafts/${s.id}`, {
    method: "PATCH",
    cookie: s.cookie,
    body: { version: s.version, ...body },
  });
  assert.equal(status, 200, JSON.stringify(json));
  s.version = json.draft.version;
  return json.draft;
}

async function readyDraft(): Promise<Session> {
  const s = await createDraft();
  await patch(s, {
    routine: { mealPeriods: ["lunch"], daysPerWeek: 3, deliveryContext: "home" },
    duration: { cycle: "weekly", renewal: "decide_later" },
  });
  await patch(s, { status: "ready_to_generate" });
  return s;
}

test("draft creation returns a typed 429 with Retry-After once its budget is spent", async () => {
  process.env["PLAN_DRAFT_CREATE_PER_MIN"] = "2";

  const seen: number[] = [];
  let limited: { status: number; json: any; retryAfter: string | null } | null = null;
  for (let i = 0; i < 6; i++) {
    const res = await call("/plan-drafts", {
      method: "POST",
      body: { journey: "custom" },
    });
    seen.push(res.status);
    if (res.status === 201) CREATED_DRAFT_IDS.push(res.json.draft.id);
    if (res.status === 429 && !limited) limited = res;
  }

  assert.ok(limited, `expected a 429 among ${JSON.stringify(seen)}`);
  assert.equal(limited.json.code, "PLAN_DRAFT_CREATION_RATE_LIMITED");
  assert.equal(limited.retryAfter, "60", "Retry-After must be sent, in seconds");
  assert.equal(limited.json.retryAfterSeconds, 60);
});

test("generation has its OWN budget, and a throttled call takes no generation claim", async () => {
  const s = await readyDraft();
  process.env["PLAN_GENERATION_PER_MIN"] = "0.5"; // < 1: the first call is already over

  const res = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(res.status, 429);
  assert.equal(res.json.code, "PLAN_GENERATION_RATE_LIMITED");
  assert.equal(res.retryAfter, "60");

  relaxAllLimits();
  const after = await call(`/plan-drafts/${s.id}`, { cookie: s.cookie });
  assert.equal(
    after.json.draft.status,
    "ready_to_generate",
    "a throttled generate must not have claimed the draft",
  );
  assert.equal(
    after.json.draft.generationAttemptId,
    null,
    "no generation lease may be taken by a refused request",
  );
  assert.equal(after.json.draft.version, s.version, "and nothing was written");
});

test("shuffle has its own budget, and a throttled shuffle leaves the lineup untouched", async () => {
  const s = await readyDraft();
  const gen = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(gen.status, 200, JSON.stringify(gen.json));
  s.version = gen.json.draft.version;
  const lineupBefore = JSON.stringify(gen.json.draft.lineup);

  process.env["PLAN_SHUFFLE_PER_MIN"] = "0.5";
  const res = await call(`/plan-drafts/${s.id}/lineup/shuffle`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(res.status, 429);
  assert.equal(res.json.code, "PLAN_SHUFFLE_RATE_LIMITED");

  relaxAllLimits();
  const after = await call(`/plan-drafts/${s.id}`, { cookie: s.cookie });
  assert.equal(
    JSON.stringify(after.json.draft.lineup),
    lineupBefore,
    "a throttled shuffle must not rewrite the lineup",
  );
  assert.equal(
    after.json.draft.previousLineup,
    null,
    "nor record an Undo snapshot",
  );
  assert.equal(after.json.draft.version, s.version);
});

test("exhausting the generate budget does not throttle cheap edits", async () => {
  // The whole point of splitting the policies: a customer who has hit the
  // expensive budget can still edit their preferences.
  const s = await readyDraft();
  process.env["PLAN_GENERATION_PER_MIN"] = "0.5";

  const blocked = await call(`/plan-drafts/${s.id}/generate`, {
    method: "POST",
    cookie: s.cookie,
    body: { version: s.version },
  });
  assert.equal(blocked.status, 429);

  const edit = await call(`/plan-drafts/${s.id}`, {
    method: "PATCH",
    cookie: s.cookie,
    body: { version: s.version, goal: "maintain" },
  });
  assert.equal(edit.status, 200, "mutation budget is separate from generation");
});
