import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, userPreferencesTable, sessionsTable, userConsentsTable } from "@workspace/db";

import preferencesRouter from "./preferences";
import authRouter from "./auth";
import userConsentsRouter from "./userConsents";
import { purgeDeletedAccountsJob } from "../lib/auth";

interface TestUser {
  id: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
      session?: { destroy: (cb: () => void) => void };
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.session = {
      destroy: (cb) => cb(),
    };
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
  app.use(preferencesRouter);
  app.use(authRouter);
  app.use(userConsentsRouter);
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `dpdp-${id}@example.test`,
    firstName: "Compliance",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);

  // Initialize empty preferences
  await db.insert(userPreferencesTable).values({
    userId: id,
    allergens: [],
    dislikedIngredients: [],
    medicalConditions: ["diabetes", "gerd", "pcos"],
    hba1cPct: 7.8,
    pcosHistory: true,
    heightCm: 175,
    weightKg: 68.5,
  });

  return u;
}

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
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

await new Promise<void>((resolve) => {
  server = makeApp().listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("DELETE /user/health-data/:field removes clinical metrics and returns verbatim notice", async () => {
  const user = await makeUser();

  // 1. Delete hba1cPct
  let r = await api("DELETE", "/user/health-data/hba1cPct", null, user);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.success, true);
  assert.equal(r.json.message, "HbA1c removed. Meal ranking will update and no longer use this value.");

  let [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, user.id));
  assert.equal(prefs!.hba1cPct, null, "hba1c must be nullified");

  // 2. Delete pcosHistory
  r = await api("DELETE", "/user/health-data/pcosHistory", null, user);
  assert.equal(r.status, 200);
  assert.equal(r.json.message, "PCOS history removed. Meal ranking will update and no longer use this value.");

  [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, user.id));
  assert.equal(prefs!.pcosHistory, false, "pcosHistory must be false after deletion");

  // 3. Delete specific medicalCondition condition (GERD)
  r = await api("DELETE", "/user/health-data/medicalConditions?condition=gerd", null, user);
  assert.equal(r.status, 200);
  assert.equal(r.json.message, "GERD removed. Meal ranking will update and no longer use this value.");

  [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, user.id));
  assert.deepEqual(prefs!.medicalConditions, ["diabetes", "pcos"], "GERD should be filtered out from medicalConditions");

  // 4. Delete all medicalConditions
  r = await api("DELETE", "/user/health-data/medicalConditions", null, user);
  assert.equal(r.status, 200);
  assert.equal(r.json.message, "Medical conditions removed. Meal ranking will update and no longer use this value.");

  [prefs] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, user.id));
  assert.deepEqual(prefs!.medicalConditions, [], "medicalConditions should be empty array");
});

test("DELETE /user/account soft-deletes user", async () => {
  const user = await makeUser();

  // Create mock active session row
  await db.insert(sessionsTable).values({
    sid: `test-sess-${user.id}`,
    sess: { user: { id: user.id } },
    expire: new Date(Date.now() + 3600 * 1000),
  });

  const r = await api("DELETE", "/user/account", null, user);
  assert.equal(r.status, 200);
  assert.equal(r.json.success, true);

  // Check deletedAt timestamp set
  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  assert.ok(userRow!.deletedAt != null, "deletedAt should be set");

  // Check active sessions revoked
  const [sess] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, `test-sess-${user.id}`));
  assert.equal(sess, undefined, "Active session should be deleted/revoked");
});

test("purgeDeletedAccountsJob hard-deletes soft-deleted users after 30 days", async () => {
  const user = await makeUser();

  // Set deletedAt to 31 days ago
  const thirtyOneDaysAgo = new Date();
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
  await db.update(usersTable).set({ deletedAt: thirtyOneDaysAgo }).where(eq(usersTable.id, user.id));

  // Run the purge sweep job
  await purgeDeletedAccountsJob();

  // User should be completely hard-deleted from database
  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  assert.equal(userRow, undefined, "User row should be hard-purged");

  // Cascade constraints should automatically delete preference record
  const [prefRow] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, user.id));
  assert.equal(prefRow, undefined, "User preference record should be cascade-deleted/purged");
});
