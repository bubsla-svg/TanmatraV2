/**
 * Integration tests for POST /coach-agent/chat — the coach chat endpoint, which
 * had no HTTP route test before this (only behavioural evals). Focuses on the
 * bits that DON'T need a model key, so it runs in plain test/CI:
 *   - the auth gate (401) + payload contract (400)
 *   - the DETERMINISTIC clinical-refusal path: a clinical message is refused by
 *     the preflight BEFORE any model call, and the NDJSON stream carries a
 *     synthesized book_rd action card + a finish with the refusal reason.
 *
 * Run: node --test --import tsx ./src/routes/coachAgent.test.ts
 * Needs DATABASE_URL (the gateway persists every run to ai_runs). Same tiny-
 * express harness as loyalty.referral.test.ts.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { inArray } from "drizzle-orm";
import { db, aiRunsTable, usersTable } from "@workspace/db";

import coachRouter from "./coachAgent";

interface TestUser { id: string }
let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const USER_REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as { user?: unknown; log: Record<string, (...a: unknown[]) => void>; isAuthenticated: () => boolean };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(coachRouter);
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({ id, email: `coach-${id}@example.test`, firstName: "Coach" });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return user;
}

/** POST and parse the NDJSON body into an array of events. */
async function chat(body: unknown, user?: TestUser): Promise<{ status: number; events: any[]; raw: string }> {
  const res = await fetch(`${baseUrl}/coach-agent/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user.id } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  const events = res.headers.get("content-type")?.includes("ndjson")
    ? raw.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return { status: res.status, events, raw };
}

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(aiRunsTable).where(inArray(aiRunsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("POST /coach-agent/chat requires auth (401 signed out)", async () => {
  const r = await chat({ message: "hi" });
  assert.equal(r.status, 401);
});

test("POST /coach-agent/chat rejects an empty/invalid message (400)", async () => {
  const user = await makeUser();
  const r = await chat({ message: "" }, user);
  assert.equal(r.status, 400);
});

test("a clinical question is refused by the preflight (no model key needed) and streams a book_rd card + refusal reason", async () => {
  const user = await makeUser();
  const r = await chat({ message: "I have type 2 diabetes — what should I eat to keep my blood sugar in range?" }, user);
  assert.equal(r.status, 200);

  // The client keys action cards off result.action.kind (NOT the tool name),
  // so that's the contract we assert. The refusal synthesizes the SAME tool
  // name a model-driven booking would emit — book_rd_appointment — which we
  // pin here so a rename can't silently drift the stream.
  const bookCard = r.events.find((e) => e.type === "tool-result" && e.result?.action?.kind === "book_rd");
  assert.ok(bookCard, `stream must synthesize a book_rd card; got: ${r.raw.slice(0, 300)}`);
  assert.equal(bookCard.name, "book_rd_appointment");
  assert.equal(bookCard.result.action.kind, "book_rd");
  assert.equal(bookCard.result.action.href, "/rd");

  const finish = r.events.find((e) => e.type === "finish");
  assert.ok(finish, "stream must end with a finish event");
  assert.equal(finish.refusalReason, "clinical_diabetes");
  assert.equal(finish.escalated, true);
});
