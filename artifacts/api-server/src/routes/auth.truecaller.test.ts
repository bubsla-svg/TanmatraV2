/**
 * Integration tests for POST /auth/truecaller/verify — the hardened Truecaller
 * 1-Tap sign-in endpoint (Tier 1, PR 1 of the native-onboarding port).
 *
 * The original native-branch endpoint trusted a client-supplied phone + opaque
 * token, so anyone could mint a verified-phone session for any number. This
 * suite pins the fixed behaviour: the phone is derived from a verified source,
 * bad requests are rejected, and the endpoint fails closed.
 *
 * These run in Truecaller MOCK MODE (no TRUECALLER_CLIENT_ID, NODE_ENV=test):
 * the verifier accepts a dev-supplied phone so we can exercise the route,
 * upsert, session and cookie against real Postgres without external creds. The
 * real OAuth verification path (token exchange + userinfo) is unit-tested in
 * lib/truecaller.test.ts with an injected fetch.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/auth.truecaller.test.ts
 * (needs DATABASE_URL pointing at a live Postgres.)
 */

import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";
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
import { eq, like, inArray, sql } from "drizzle-orm";
import { db, usersTable, sessionsTable, rateLimitsTable } from "@workspace/db";

import authRouter from "./auth";

const RUN_ID = randomUUID().slice(0, 8);
// A deterministic, unique Indian mobile number per run so parallel/re-runs
// never collide on the phoneE164 unique constraint.
const TEST_PHONE = `+9198${RUN_ID.replace(/\D/g, "").padEnd(8, "0").slice(0, 8)}`;

let server: http.Server;
let baseUrl = "";
let savedClientId: string | undefined;
let savedNodeEnv: string | undefined;

function makeApp(): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  // Minimal auth/log shim — the endpoint is public (pre-session).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
      user: unknown;
    };
    r.isAuthenticated = () => false;
    r.user = null;
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
  app.use(authRouter);
  return app;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any; setCookie: string | null }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

async function clearTruecallerRateLimits(): Promise<void> {
  await db
    .delete(rateLimitsTable)
    .where(like(rateLimitsTable.key, "auth:tc:%"));
}

async function deleteTestUser(): Promise<void> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phoneE164, TEST_PHONE));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  // Sessions carry the user id inside the JSON blob (sess->'user'->>'id'),
  // matching the DELETE /user/account handler's own cleanup query.
  for (const id of ids) {
    await db
      .delete(sessionsTable)
      .where(sql`${sessionsTable.sess}->'user'->>'id' = ${id}`);
  }
  await db.delete(usersTable).where(inArray(usersTable.id, ids));
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
  authorizationCode: "mock-auth-code",
  codeVerifier: "mock-pkce-verifier",
  devPhoneE164: TEST_PHONE,
  ...overrides,
});

before(async () => {
  savedClientId = process.env["TRUECALLER_CLIENT_ID"];
  savedNodeEnv = process.env["NODE_ENV"];
  // Mock mode: no client id, non-production.
  delete process.env["TRUECALLER_CLIENT_ID"];
  process.env["NODE_ENV"] = "test";
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await deleteTestUser();
});

beforeEach(async () => {
  await clearTruecallerRateLimits();
});

after(async () => {
  await deleteTestUser();
  await clearTruecallerRateLimits();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  if (savedClientId === undefined) delete process.env["TRUECALLER_CLIENT_ID"];
  else process.env["TRUECALLER_CLIENT_ID"] = savedClientId;
  if (savedNodeEnv === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = savedNodeEnv;
});

test("400 when the OAuth code/verifier is missing", async () => {
  const res = await api("POST", "/auth/truecaller/verify", {
    devPhoneE164: TEST_PHONE,
  });
  assert.equal(res.status, 400);
});

test("valid 1-tap mints a session, upserts the user, sets the cookie", async () => {
  await deleteTestUser();
  const res = await api("POST", "/auth/truecaller/verify", validBody());
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.user.phoneE164, TEST_PHONE);
  assert.ok(res.json.user.id, "user id present");
  // httpOnly session cookie issued.
  assert.ok(
    res.setCookie && /(^|[;\s])sid=/.test(res.setCookie),
    "sid cookie set",
  );
  assert.match(res.setCookie!, /HttpOnly/i);

  // User row was actually persisted with the verified phone + signup source.
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phoneE164, TEST_PHONE));
  assert.ok(row, "user persisted");
  assert.equal(row!.signupSource, "truecaller");
  assert.ok(row!.phoneVerifiedAt, "phone marked verified");
});

test("second sign-in returns the SAME user (idempotent upsert, no clobber)", async () => {
  await deleteTestUser();
  const first = await api("POST", "/auth/truecaller/verify", validBody());
  assert.equal(first.status, 200);
  // Give the returning user an edited name to prove it is not overwritten.
  await db
    .update(usersTable)
    .set({ firstName: "Edited", lastName: "Name" })
    .where(eq(usersTable.phoneE164, TEST_PHONE));

  const second = await api("POST", "/auth/truecaller/verify", validBody());
  assert.equal(second.status, 200);
  assert.equal(second.json.user.id, first.json.user.id, "same user id");

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phoneE164, TEST_PHONE));
  assert.equal(row!.firstName, "Edited", "existing name preserved on re-login");
});

test("401 when verification cannot produce a phone (mock: no devPhoneE164)", async () => {
  const res = await api(
    "POST",
    "/auth/truecaller/verify",
    validBody({ devPhoneE164: undefined }),
  );
  assert.equal(res.status, 401);
});

test("429 after the per-IP burst limit is exceeded", async () => {
  await clearTruecallerRateLimits();
  let sawLimit = false;
  // Limit is 30/hr per IP; a docs-safe burst of 35 from the same loopback IP.
  for (let i = 0; i < 35; i++) {
    const res = await api("POST", "/auth/truecaller/verify", validBody());
    if (res.status === 429) {
      sawLimit = true;
      break;
    }
  }
  assert.ok(sawLimit, "per-IP rate limit engaged");
});
