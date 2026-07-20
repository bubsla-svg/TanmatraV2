/**
 * Integration tests for the corporate-leads capture route (playbook Part
 * 3.3 — the WhatsApp lead-leak fix).
 *
 *   POST /corporate-leads — public lead capture: zod validation contract
 *                           (kind / name / workEmail / company /
 *                           teamSizeBand + optional fields), 201 + row
 *                           persisted with status 'new', best-effort
 *                           funnel_events breadcrumb, conservative
 *                           per-IP rate limit.
 *   GET  /corporate-leads — admin (catalog-scope) pipeline list with
 *                           ?status= filter, newest first.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/corporateLeads.test.ts
 *
 * Like the sibling route tests (groupOrders.test.ts), this stands up a
 * tiny express app on a random port with a stubbed auth/log middleware —
 * it needs DATABASE_URL pointing at a live Postgres, because the route,
 * the rate limiter, and the assertions all go through @workspace/db.
 */

import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { and, eq, like, sql } from "drizzle-orm";
import {
  db,
  corporateLeadsTable,
  funnelEventsTable,
  rateLimitsTable,
} from "@workspace/db";

import corporateLeadsRouter from "./corporateLeads";

const RUN_ID = randomUUID().slice(0, 8);
const EMAIL_PREFIX = `corp-lead-test-${RUN_ID}`;
const RUN_SOURCE = `/partners/test?run=${RUN_ID}`;
const ADMIN_TOKEN = `test-admin-token-${RUN_ID}`;

let server: http.Server;
let baseUrl = "";
let savedAdminToken: string | undefined;
const CREATED_LEAD_IDS: number[] = [];

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  // Minimal stand-in for the real auth + pino-http middlewares: the route
  // is public, so no user is injected — just the logger + isAuthenticated
  // shape the handlers expect.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
    };
    r.isAuthenticated = () => false;
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
  app.use(corporateLeadsRouter);
  return app;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
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

function validLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "gym",
    name: "Rahul Sharma",
    workEmail: `${EMAIL_PREFIX}-${randomUUID().slice(0, 8)}@example.test`,
    company: "Iron Gym NCR",
    teamSizeBand: "101-500",
    parkOrSector: "Sector 62, Noida",
    phone: "+91 99999 88888",
    message: "Interested in a bundled membership pilot.",
    source: RUN_SOURCE,
    ...overrides,
  };
}

/**
 * The route ships a deliberately conservative per-IP limit (5/hour on the
 * `corporate:leads` scope). Every test in this file comes from the same
 * loopback IP, so reset the scope's counters before each test — otherwise
 * the suite (and any re-run inside the window) would trip the limiter.
 */
async function clearLeadRateLimits(): Promise<void> {
  await db
    .delete(rateLimitsTable)
    .where(like(rateLimitsTable.key, "corporate:leads:%"));
}

before(async () => {
  savedAdminToken = process.env["RD_ADMIN_TOKEN"];
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

beforeEach(async () => {
  await clearLeadRateLimits();
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  if (savedAdminToken === undefined) delete process.env["RD_ADMIN_TOKEN"];
  else process.env["RD_ADMIN_TOKEN"] = savedAdminToken;
  await db
    .delete(corporateLeadsTable)
    .where(like(corporateLeadsTable.workEmail, `${EMAIL_PREFIX}-%`));
  await db
    .delete(funnelEventsTable)
    .where(
      and(
        eq(funnelEventsTable.name, "corporate_lead_submitted"),
        sql`${funnelEventsTable.props}->>'source' = ${RUN_SOURCE}`,
      ),
    );
  await clearLeadRateLimits();
});

test("POST /corporate-leads persists a gym lead, defaults status to new, and logs the funnel event", async () => {
  const payload = validLead({ workEmail: `${EMAIL_PREFIX}-Full@Example.Test` });
  const r = await api("POST", "/corporate-leads", payload);
  assert.equal(r.status, 201, `expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.deepEqual(r.json, { ok: true });

  const [row] = await db
    .select()
    .from(corporateLeadsTable)
    .where(eq(corporateLeadsTable.workEmail, `${EMAIL_PREFIX}-full@example.test`));
  assert.ok(row, "lead row must be persisted");
  assert.equal(row!.kind, "gym");
  assert.equal(row!.name, "Rahul Sharma");
  assert.equal(row!.company, "Iron Gym NCR");
  assert.equal(row!.teamSizeBand, "101-500");
  assert.equal(row!.parkOrSector, "Sector 62, Noida");
  assert.equal(row!.phone, "+91 99999 88888");
  assert.equal(row!.status, "new", "status must default to 'new'");
  assert.ok(row!.createdAt instanceof Date);

  const events = await db
    .select()
    .from(funnelEventsTable)
    .where(
      and(
        eq(funnelEventsTable.name, "corporate_lead_submitted"),
        sql`${funnelEventsTable.props}->>'source' = ${RUN_SOURCE}`,
      ),
    );
  assert.ok(events.length >= 1, "funnel breadcrumb must be written");
  const props = events[events.length - 1]!.props as Record<string, unknown>;
  assert.equal(props["kind"], "gym");
  assert.equal(props["team_size_band"], "101-500");
});

test("POST /corporate-leads accepts a minimal payload without optional fields", async () => {
  const email = `${EMAIL_PREFIX}-minimal@example.test`;
  const r = await api("POST", "/corporate-leads", {
    kind: "fitness_club",
    name: "Vikramaditya",
    workEmail: email,
    company: "Noida Runners Club",
    teamSizeBand: "21-100",
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));

  const [row] = await db
    .select()
    .from(corporateLeadsTable)
    .where(eq(corporateLeadsTable.workEmail, email));
  assert.ok(row);
  assert.equal(row!.kind, "fitness_club");
  assert.equal(row!.parkOrSector, null);
  assert.equal(row!.phone, null);
  assert.equal(row!.message, null);
  assert.equal(row!.source, null);
});

test("POST /corporate-leads rejects an unknown kind", async () => {
  const r = await api("POST", "/corporate-leads", validLead({ kind: "franchise" }));
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "invalid payload");
  assert.ok(
    (r.json.issues as Array<{ path: string }>).some((i) => i.path === "kind"),
    "issue must point at kind",
  );
});

test("POST /corporate-leads rejects an out-of-contract teamSizeBand", async () => {
  const r = await api(
    "POST",
    "/corporate-leads",
    validLead({ teamSizeBand: "20-50" }),
  );
  assert.equal(r.status, 400);
  assert.ok(
    (r.json.issues as Array<{ path: string }>).some((i) => i.path === "teamSizeBand"),
  );
});

test("POST /corporate-leads rejects bad email, short name, and missing company", async () => {
  const badEmail = await api(
    "POST",
    "/corporate-leads",
    validLead({ workEmail: "not-an-email" }),
  );
  assert.equal(badEmail.status, 400);

  const shortName = await api("POST", "/corporate-leads", validLead({ name: "R" }));
  assert.equal(shortName.status, 400);

  const { company: _company, ...withoutCompany } = validLead();
  const missingCompany = await api("POST", "/corporate-leads", withoutCompany);
  assert.equal(missingCompany.status, 400);
});

test("POST /corporate-leads rejects oversized optional fields", async () => {
  const r = await api(
    "POST",
    "/corporate-leads",
    validLead({ message: "x".repeat(1001) }),
  );
  assert.equal(r.status, 400);
  assert.ok(
    (r.json.issues as Array<{ path: string }>).some((i) => i.path === "message"),
  );
});

test("POST /corporate-leads rate-limits the 6th request from one IP", async () => {
  // Invalid bodies still pass through the limiter first, so this exercises
  // the 429 without inserting rows.
  for (let i = 0; i < 5; i++) {
    const r = await api("POST", "/corporate-leads", {});
    assert.equal(r.status, 400, `request ${i + 1} should reach validation`);
  }
  const sixth = await api("POST", "/corporate-leads", {});
  assert.equal(sixth.status, 429);
  assert.equal(sixth.json.error, "rate_limited");
});

test("GET /corporate-leads requires catalog/admin scope", async () => {
  const r = await api("GET", "/corporate-leads");
  assert.equal(r.status, 403);
});

test("GET /corporate-leads lists newest first and filters by status", async () => {
  const olderEmail = `${EMAIL_PREFIX}-older@example.test`;
  const newerEmail = `${EMAIL_PREFIX}-newer@example.test`;
  const rows = await db
    .insert(corporateLeadsTable)
    .values([
      {
        kind: "corporate",
        name: "Older Lead",
        workEmail: olderEmail,
        company: "Older Co",
        teamSizeBand: "1-20",
        status: "contacted",
        createdAt: new Date(Date.now() - 60_000),
      },
      {
        kind: "gym",
        name: "Newer Lead",
        workEmail: newerEmail,
        company: "Newer Gym",
        teamSizeBand: "500+",
        status: "new",
      },
    ])
    .returning({ id: corporateLeadsTable.id });
  CREATED_LEAD_IDS.push(...rows.map((r) => r.id));

  const adminHeaders = { "x-admin-token": ADMIN_TOKEN };

  const all = await api("GET", "/corporate-leads", undefined, adminHeaders);
  assert.equal(all.status, 200, JSON.stringify(all.json));
  const leads = all.json.leads as Array<{ workEmail: string }>;
  const olderIdx = leads.findIndex((l) => l.workEmail === olderEmail);
  const newerIdx = leads.findIndex((l) => l.workEmail === newerEmail);
  assert.ok(olderIdx >= 0 && newerIdx >= 0, "both inserted leads must be listed");
  assert.ok(newerIdx < olderIdx, "newest lead must come first");
  assert.ok(leads.length <= 100, "list must be capped at 100");

  const contacted = await api(
    "GET",
    "/corporate-leads?status=contacted",
    undefined,
    adminHeaders,
  );
  assert.equal(contacted.status, 200);
  const contactedLeads = contacted.json.leads as Array<{
    workEmail: string;
    status: string;
  }>;
  assert.ok(contactedLeads.every((l) => l.status === "contacted"));
  assert.ok(contactedLeads.some((l) => l.workEmail === olderEmail));
  assert.ok(!contactedLeads.some((l) => l.workEmail === newerEmail));

  const bogus = await api(
    "GET",
    "/corporate-leads?status=bogus",
    undefined,
    adminHeaders,
  );
  assert.equal(bogus.status, 400);
});
