/**
 * Integration tests for Phase 3 Ecosystem API endpoints:
 * symptom logs, community Q&A threads, meal history, and challenge tracker.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, symptomLogsTable, communityQaThreadsTable, usersTable } from "@workspace/db";
import ecosystemRouter from "./ecosystem";

interface TestUser {
  id: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
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
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(ecosystemRouter);
  return app;
}

async function createUser(prefix: string): Promise<string> {
  const id = `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  await db.insert(usersTable).values({ id });
  CREATED_USER_IDS.push(id);
  USER_REGISTRY.set(id, { id });
  return id;
}

before(async () => {
  const app = makeApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  for (const uid of CREATED_USER_IDS) {
    await db.delete(symptomLogsTable).where(eq(symptomLogsTable.userId, uid)).catch(() => {});
    await db.delete(communityQaThreadsTable).where(eq(communityQaThreadsTable.userId, uid)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, uid)).catch(() => {});
  }
});

test("POST and GET /symptom-logs records physiological symptoms", async () => {
  const userId = await createUser("symptom_user");
  const postRes = await fetch(`${baseUrl}/symptom-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      loggedDate: "2026-07-25",
      symptomType: "bloating",
      severity: 2,
      notes: "Slight bloating after lunch",
    }),
  });
  assert.equal(postRes.status, 201);
  const data = (await postRes.json()) as any;
  assert.equal(data.symptomType, "bloating");

  const getRes = await fetch(`${baseUrl}/symptom-logs`, {
    headers: { "x-test-user-id": userId },
  });
  assert.equal(getRes.status, 200);
  const list = (await getRes.json()) as any[];
  assert.equal(list.length, 1);
});

test("POST and GET /community/qa manages question threads", async () => {
  const userId = await createUser("qa_user");
  const postRes = await fetch(`${baseUrl}/community/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      questionTitle: "Best macro ratio for insulin sensitivity?",
      questionBody: "Looking for verified dietary recommendations for afternoon energy dips.",
      category: "pcos",
    }),
  });
  assert.equal(postRes.status, 201);
  const data = (await postRes.json()) as any;
  assert.equal(data.category, "pcos");

  const getRes = await fetch(`${baseUrl}/community/qa`);
  assert.equal(getRes.status, 200);
  const threads = (await getRes.json()) as any[];
  assert.ok(threads.length >= 1);
});

test("GET /nutrition-history returns user meal targets and logs", async () => {
  const userId = await createUser("hist_user");
  const res = await fetch(`${baseUrl}/nutrition-history`, {
    headers: { "x-test-user-id": userId },
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.ok(data.targets.calorieTarget >= 2000);
});

test("GET /challenge-tracker returns check-ins and active routines", async () => {
  const userId = await createUser("chall_user");
  const res = await fetch(`${baseUrl}/challenge-tracker`, {
    headers: { "x-test-user-id": userId },
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.ok(Array.isArray(data.challenges));
});
