/**
 * Integration tests for the PlanDraft draft-lifecycle contract (PR A2.1).
 *
 *   POST /plan-drafts             — create (guest or authenticated)
 *   GET  /plan-drafts/:id         — restore, ownership-gated
 *   PATCH /plan-drafts/:id        — versioned update, status state machine
 *   POST /plan-drafts/:id/claim   — guest -> authenticated ownership transfer
 *
 * Run with:
 *   node --test --import tsx ./src/routes/planDrafts.test.ts
 *
 * Stands up a tiny express app on a random port, mounting the real router
 * with the real `cookie-parser` (guest ownership is cookie-based — it must
 * be exercised for real, not stubbed) and a minimal auth stub that reads a
 * synthetic user id from an `x-test-user-id` header, mirroring
 * groupOrders.test.ts.
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import { inArray } from "drizzle-orm";
import { db, planDraftsTable, usersTable } from "@workspace/db";

import planDraftsRouter from "./planDrafts";

interface TestUser {
  id: string;
  firstName: string;
  email: string;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_DRAFT_IDS: string[] = [];
const USER_REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      isAuthenticated: () => boolean;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    next();
  });
  app.use(planDraftsRouter);
  return app;
}

async function makeUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `plan-draft-test-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const user: TestUser = { id, firstName: label, email: `plan-draft-test-${label}@example.test` };
  USER_REGISTRY.set(id, user);
  return user;
}

/** Extracts the plan_draft_id value from a response's Set-Cookie headers,
 *  if present, for reuse as a Cookie header on subsequent requests. */
function extractDraftCookie(res: globalThis.Response): string | null {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const [name, value] = (pair ?? "").split("=");
    if (name === "plan_draft_id" && value) return `plan_draft_id=${value}`;
  }
  return null;
}

interface ApiOpts {
  user?: TestUser;
  cookie?: string | null;
}

async function api(
  method: string,
  path: string,
  body: unknown | undefined,
  opts: ApiOpts = {},
): Promise<{ status: number; json: any; cookie: string | null; raw: globalThis.Response }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.user) headers["x-test-user-id"] = opts.user.id;
  if (opts.cookie) headers["cookie"] = opts.cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, cookie: extractDraftCookie(res), raw: res };
}

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  if (CREATED_DRAFT_IDS.length > 0) {
    await db.delete(planDraftsTable).where(inArray(planDraftsTable.id, CREATED_DRAFT_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function createGuestDraft(journey: "recommended" | "custom" = "custom") {
  const r = await api("POST", "/plan-drafts", { journey });
  assert.equal(r.status, 201, `create: ${JSON.stringify(r.json)}`);
  CREATED_DRAFT_IDS.push(r.json.draft.id);
  assert.ok(r.cookie, "create must set the plan_draft_id cookie");
  return { draft: r.json.draft as { id: string; version: number }, cookie: r.cookie as string };
}

test("POST /plan-drafts creates a guest draft with version 1 and no owner", async () => {
  const { draft } = await createGuestDraft();
  assert.equal(draft.version, 1);
  assert.equal((draft as any).userId, null);
  assert.equal((draft as any).status, "collecting_preferences");
});

test("GET /plan-drafts/:id restores a guest draft only with the matching cookie", async () => {
  const { draft, cookie } = await createGuestDraft();

  const withCookie = await api("GET", `/plan-drafts/${draft.id}`, undefined, { cookie });
  assert.equal(withCookie.status, 200);
  assert.equal(withCookie.json.draft.id, draft.id);

  const withoutCookie = await api("GET", `/plan-drafts/${draft.id}`, undefined);
  assert.equal(withoutCookie.status, 404, "id alone must not unlock a guest draft");
});

test("PATCH /plan-drafts/:id updates fields and bumps version under the correct version", async () => {
  const { draft, cookie } = await createGuestDraft();

  const patched = await api(
    "PATCH",
    `/plan-drafts/${draft.id}`,
    { version: 1, goal: "steady_energy", hardAllergens: ["peanut"] },
    { cookie },
  );
  assert.equal(patched.status, 200, JSON.stringify(patched.json));
  assert.equal(patched.json.draft.version, 2);
  assert.equal(patched.json.draft.goal, "steady_energy");
  assert.deepEqual(patched.json.draft.hardAllergens, ["peanut"]);
});

test("PATCH /plan-drafts/:id rejects a stale version with 409", async () => {
  const { draft, cookie } = await createGuestDraft();

  const first = await api("PATCH", `/plan-drafts/${draft.id}`, { version: 1, goal: "a" }, { cookie });
  assert.equal(first.status, 200);

  // Retry with the now-stale version 1 the client originally read.
  const stale = await api("PATCH", `/plan-drafts/${draft.id}`, { version: 1, goal: "b" }, { cookie });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, "stale_version");
});

test("PATCH /plan-drafts/:id rejects a status only the generation engine may set", async () => {
  const { draft, cookie } = await createGuestDraft();

  // "lineup_ready" is written by the generation engine (A2.2), never by a
  // client PATCH — rejected at the schema boundary (400), before the
  // draft's current status is even consulted.
  const jump = await api(
    "PATCH",
    `/plan-drafts/${draft.id}`,
    { version: 1, status: "lineup_ready" },
    { cookie },
  );
  assert.equal(jump.status, 400);

  const legal = await api(
    "PATCH",
    `/plan-drafts/${draft.id}`,
    { version: 1, status: "ready_to_generate" },
    { cookie },
  );
  assert.equal(legal.status, 200);
  assert.equal(legal.json.draft.status, "ready_to_generate");
});

test("POST /plan-drafts/:id/claim requires authentication", async () => {
  const { draft, cookie } = await createGuestDraft();
  const r = await api("POST", `/plan-drafts/${draft.id}/claim`, undefined, { cookie });
  assert.equal(r.status, 401);
});

test("POST /plan-drafts/:id/claim rejects a claim without the guest cookie", async () => {
  const user = await makeUser("claim-no-cookie");
  const { draft } = await createGuestDraft();

  const r = await api("POST", `/plan-drafts/${draft.id}/claim`, undefined, { user });
  assert.equal(r.status, 404, "knowing the id must not be enough to claim it");
});

test("POST /plan-drafts/:id/claim transfers ownership, then GET requires the matching authenticated user", async () => {
  const owner = await makeUser("claim-owner");
  const stranger = await makeUser("claim-stranger");
  const { draft, cookie } = await createGuestDraft();

  const claimed = await api("POST", `/plan-drafts/${draft.id}/claim`, undefined, { user: owner, cookie });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.json));
  assert.equal(claimed.json.draft.userId, owner.id);

  // The cookie alone no longer unlocks it — it belongs to `owner` now.
  const byCookieOnly = await api("GET", `/plan-drafts/${draft.id}`, undefined, { cookie });
  assert.equal(byCookieOnly.status, 404);

  // A different authenticated user must not read another customer's draft.
  const byStranger = await api("GET", `/plan-drafts/${draft.id}`, undefined, { user: stranger });
  assert.equal(byStranger.status, 404);

  // The owner reads it fine via their session alone, no cookie needed.
  const byOwner = await api("GET", `/plan-drafts/${draft.id}`, undefined, { user: owner });
  assert.equal(byOwner.status, 200);
  assert.equal(byOwner.json.draft.id, draft.id);
});

test("claiming a new draft supersedes the same user's prior live draft in the same journey", async () => {
  const user = await makeUser("claim-supersede");

  const first = await createGuestDraft("custom");
  const firstClaim = await api("POST", `/plan-drafts/${first.draft.id}/claim`, undefined, {
    user,
    cookie: first.cookie,
  });
  assert.equal(firstClaim.status, 200);

  const second = await createGuestDraft("custom");
  const secondClaim = await api("POST", `/plan-drafts/${second.draft.id}/claim`, undefined, {
    user,
    cookie: second.cookie,
  });
  assert.equal(secondClaim.status, 200);

  const firstAfter = await api("GET", `/plan-drafts/${first.draft.id}`, undefined, { user });
  assert.equal(firstAfter.status, 200);
  assert.equal(firstAfter.json.draft.status, "superseded");
});

test("claim advances the version counter and invalidates the caller's old version", async () => {
  // NOTE ON COVERAGE: this pins the sequential properties only. The defect the
  // claim CAS fix addresses needs a write to land *between* claim's own read
  // and its UPDATE, and there is no seam to force that interleaving through the
  // HTTP surface — a timing-dependent Promise.all race would be flaky, not a
  // regression test. The fix (version predicate + DB-side increment, matching
  // the supersede statement three lines above it in the same transaction) is
  // therefore argued from the invariant, not proven by this test.
  const user = await makeUser("claim-version");
  const created = await createGuestDraft("custom");
  const draftId = created.draft.id;

  const patched = await api(
    "PATCH",
    `/plan-drafts/${draftId}`,
    { version: created.draft.version, goal: "lose_weight" },
    { cookie: created.cookie },
  );
  assert.equal(patched.status, 200);
  const versionBeforeClaim = patched.json.draft.version;

  const claim = await api("POST", `/plan-drafts/${draftId}/claim`, undefined, {
    user,
    cookie: created.cookie,
  });
  assert.equal(claim.status, 200, JSON.stringify(claim.json));
  assert.ok(
    claim.json.draft.version > versionBeforeClaim,
    `claim must move the counter forward: ${versionBeforeClaim} -> ${claim.json.draft.version}`,
  );

  // The version the caller held before the claim is now genuinely stale and
  // must be refused, not accepted against a rolled-back counter.
  const stale = await api(
    "PATCH",
    `/plan-drafts/${draftId}`,
    { version: versionBeforeClaim, goal: "gain_muscle" },
    { user },
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, "stale_version");

  // And the field that stale write tried to change was not applied.
  const reread = await api("GET", `/plan-drafts/${draftId}`, undefined, { user });
  assert.equal(reread.json.draft.goal, "lose_weight");
});

test("claiming an already-claimed-by-me draft stays idempotent", async () => {
  const user = await makeUser("claim-idempotent");
  const created = await createGuestDraft("custom");

  const first = await api("POST", `/plan-drafts/${created.draft.id}/claim`, undefined, {
    user,
    cookie: created.cookie,
  });
  assert.equal(first.status, 200);

  const again = await api("POST", `/plan-drafts/${created.draft.id}/claim`, undefined, {
    user,
    cookie: created.cookie,
  });
  assert.equal(again.status, 200, "re-claiming your own draft must not 404 or 409");
  assert.equal(again.json.draft.id, created.draft.id);
  assert.equal(again.json.draft.userId, user.id);
});
