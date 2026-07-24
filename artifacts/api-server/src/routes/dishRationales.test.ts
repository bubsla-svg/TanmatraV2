/**
 * Integration tests for POST /dish-rationales — the "why this dish" endpoint,
 * which had no route coverage before this. Verifies the auth gate, the payload
 * contract, and that a request always comes back with one grounded rationale
 * per dish id. The model is not exercised here (no API key in test/CI), so the
 * happy path returns the deterministic fallback rationale — which is exactly
 * the safe degradation we want to lock in.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/dishRationales.test.ts
 *
 * Same tiny-express harness as loyalty.referral.test.ts; needs DATABASE_URL.
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
import { inArray } from "drizzle-orm";
import { db, dishRationalesTable, usersTable } from "@workspace/db";
import { DISHES } from "@workspace/menu-catalog";

import dishRationalesRouter from "./dishRationales";

const DISH = DISHES.find((d) => d.id > 0)!;

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
  app.use(dishRationalesRouter);
  return app;
}

async function makeUser(): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({ id, email: `rationale-${id}@example.test`, firstName: "Rationale" });
  CREATED_USER_IDS.push(id);
  const user: TestUser = { id };
  USER_REGISTRY.set(id, user);
  return user;
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
      "content-type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
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
    await db.delete(dishRationalesTable).where(inArray(dishRationalesTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

test("POST /dish-rationales requires auth (401 when signed out)", async () => {
  const r = await api("POST", "/dish-rationales", { dishIds: [DISH.id] });
  assert.equal(r.status, 401);
});

test("POST /dish-rationales rejects an invalid payload (400)", async () => {
  const user = await makeUser();
  const empty = await api("POST", "/dish-rationales", { dishIds: [] }, user);
  assert.equal(empty.status, 400);
  const bad = await api("POST", "/dish-rationales", { dishIds: ["x"] }, user);
  assert.equal(bad.status, 400);
});

test("POST /dish-rationales returns one grounded rationale per dish id", async () => {
  const user = await makeUser();
  const r = await api("POST", "/dish-rationales", { dishIds: [DISH.id] }, user);
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.ok(Array.isArray(r.json.rationales));
  assert.equal(r.json.rationales.length, 1);
  const [row] = r.json.rationales;
  assert.equal(row.dishId, DISH.id);
  assert.equal(typeof row.rationale, "string");
  assert.ok(row.rationale.length > 0 && row.rationale.length <= 140, "rationale is a non-empty, clamped line");
  assert.equal(typeof row.expanded, "string");
  assert.ok(["cache", "generated", "fallback"].includes(row.source));
});
