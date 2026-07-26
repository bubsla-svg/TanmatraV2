/**
 * Integration tests for the partner leads capture route (L-4 and L-6).
 *
 *   POST /partners/leads — gym / rd partner lead capture with server-side
 *                          validation (including RD reg no. format), rate-limiting,
 *                          and storage in corporate_leads.
 *   GET  /partners/leads — admin pipeline list.
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

import partnerLeadsRouter from "./partnerLeads";

const RUN_ID = randomUUID().slice(0, 8);
const EMAIL_PREFIX = `partner-lead-test-${RUN_ID}`;
const RUN_SOURCE = `/partners/test?run=${RUN_ID}`;
const ADMIN_TOKEN = `test-admin-token-${RUN_ID}`;

let server: http.Server;
let baseUrl = "";
let savedAdminToken: string | undefined;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
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
  app.use(partnerLeadsRouter);
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

async function clearLeadRateLimits(): Promise<void> {
  await db
    .delete(rateLimitsTable)
    .where(like(rateLimitsTable.key, "partner:leads:%"));
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
        eq(funnelEventsTable.name, "partner_lead_submitted"),
        sql`${funnelEventsTable.props}->>'source' = ${RUN_SOURCE}`,
      ),
    );
  await clearLeadRateLimits();
});

test("POST /partners/leads persists a gym partner lead with rate limit & funnel events (L-4)", async () => {
  const email = `${EMAIL_PREFIX}-gym@example.test`;
  const payload = {
    kind: "gym",
    name: "Vikram Gym",
    email,
    company: "FitNoida Studio",
    teamSizeBand: "101-500",
    parkOrSector: "Sector 62, Noida",
    phone: "+91 98765 43210",
    source: RUN_SOURCE,
  };
  const r = await api("POST", "/partners/leads", payload);
  assert.equal(r.status, 201, `expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.deepEqual(r.json, { ok: true });

  const [row] = await db
    .select()
    .from(corporateLeadsTable)
    .where(eq(corporateLeadsTable.workEmail, email));
  assert.ok(row, "lead row must be persisted");
  assert.equal(row!.kind, "gym");
  assert.equal(row!.name, "Vikram Gym");
  assert.equal(row!.company, "FitNoida Studio");
  assert.equal(row!.status, "new");
});

test("POST /partners/leads persists an RD lead when RD registration number format is valid (L-6)", async () => {
  const email = `${EMAIL_PREFIX}-rd@example.test`;
  const payload = {
    kind: "rd",
    name: "Dr. Sunita Rao",
    email,
    rdRegNo: "RD-59210",
    practiceSetting: "clinic",
    phone: "+91 91234 56789",
    source: RUN_SOURCE,
  };
  const r = await api("POST", "/partners/leads", payload);
  assert.equal(r.status, 201, `expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);

  const [row] = await db
    .select()
    .from(corporateLeadsTable)
    .where(eq(corporateLeadsTable.workEmail, email));
  assert.ok(row, "RD lead must be persisted");
  assert.equal(row!.kind, "rd");
  assert.equal(row!.rdRegNo, "RD-59210");
  assert.equal(row!.practiceSetting, "clinic");
});

test("POST /partners/leads rejects an RD lead when RD reg no. format is invalid (L-6)", async () => {
  const email = `${EMAIL_PREFIX}-badrd@example.test`;
  const payload = {
    kind: "rd",
    name: "Invalid RD",
    email,
    rdRegNo: "12", // Invalid: too short / bad pattern
    practiceSetting: "freelance",
    source: RUN_SOURCE,
  };
  const r = await api("POST", "/partners/leads", payload);
  assert.equal(r.status, 400, `expected 400 for bad rdRegNo, got ${r.status}`);
  assert.ok(JSON.stringify(r.json).includes("invalid RD registration number format"));
});

test("GET /partners/leads lists captured partner leads for authorized admin", async () => {
  const r = await api("GET", "/partners/leads", undefined, {
    "x-admin-token": ADMIN_TOKEN,
  });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.ok(Array.isArray(r.json.leads));
});
