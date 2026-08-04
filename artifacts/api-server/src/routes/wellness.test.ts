import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { inArray } from "drizzle-orm";
import { db, usersTable, nutritionLogsTable, fastingLogsTable } from "@workspace/db";

import wellnessRouter from "./wellness";

const USER_REGISTRY = new Map<string, { id: string }>();

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
  app.use(wellnessRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(nutritionLogsTable).where(inArray(nutritionLogsTable.userId, CREATED_USER_IDS));
    await db.delete(fastingLogsTable).where(inArray(fastingLogsTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(label: string, familyGroupId?: string): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `wellness-test-${label}-${id}@example.test`,
    firstName: label,
    familyGroupId,
  });
  CREATED_USER_IDS.push(id);
  const user = { id };
  USER_REGISTRY.set(id, user);
  return user;
}

const userA = await makeUser("alice");
const userB = await makeUser("bob", "fam-group-1");

test("unauthenticated GET /wellness/today -> 401", async () => {
  const res = await fetch(`${baseUrl}/wellness/today`);
  assert.equal(res.status, 401);
});

test("authenticated GET /wellness/today returns targets and logs", async () => {
  const res = await fetch(`${baseUrl}/wellness/today`, {
    headers: { "x-test-user-id": userA.id },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.ok(body.targets);
  assert.ok(Array.isArray(body.logs));
});

test("POST /wellness/water logs water intake", async () => {
  const res = await fetch(`${baseUrl}/wellness/water`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": userA.id,
    },
    body: JSON.stringify({ ml: 500 }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as any;
  assert.equal(body.log.waterMl, 500);
});

test("Fasting lifecycle: start, active, end", async () => {
  // Start fasting
  const startRes = await fetch(`${baseUrl}/wellness/fasting/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": userA.id,
    },
    body: JSON.stringify({ targetHours: 16 }),
  });
  assert.equal(startRes.status, 201);
  const startBody = (await startRes.json()) as any;
  assert.equal(startBody.log.targetHours, 16);

  // Check active fast
  const activeRes = await fetch(`${baseUrl}/wellness/fasting/active`, {
    headers: { "x-test-user-id": userA.id },
  });
  assert.equal(activeRes.status, 200);
  const activeBody = (await activeRes.json()) as any;
  assert.ok(activeBody.log);
  assert.equal(activeBody.log.id, startBody.log.id);

  // End fast
  const endRes = await fetch(`${baseUrl}/wellness/fasting/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": userA.id,
    },
    body: JSON.stringify({}),
  });
  assert.equal(endRes.status, 200);
  const endBody = (await endRes.json()) as any;
  assert.ok(endBody.log.endTime);
});

test("GET /wellness/family returns family members list", async () => {
  const res = await fetch(`${baseUrl}/wellness/family`, {
    headers: { "x-test-user-id": userB.id },
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.ok(Array.isArray(body.members));
  assert.ok(body.members.length > 0);
});
