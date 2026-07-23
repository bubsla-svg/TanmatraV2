/**
 * Access-control contract for the observability audit endpoints.
 *
 * GET /api/v1/error-reports/audit returns every buffered client error report —
 * full page URLs, JS stack traces, and session-replay interaction traces from
 * ALL users. GET /api/v1/csp-report/audit returns recorded CSP violations.
 * Both were shipped unauthenticated (broken access control); these tests lock
 * the ops gate on the read side while proving ingestion stays open (browser
 * beacons and report-uri POSTs cannot authenticate).
 *
 * DB-free: both routers and the adminGate chain import no @workspace/db.
 * Run: node --test --import tsx ./src/routes/auditGates.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import errorReportRouter from "./errorReport";
import cspReportRouter from "./cspReport";

const ADMIN_TOKEN = "test-ops-token-auditgates";

async function withApp(fn: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  // The real app's authMiddleware attaches isAuthenticated(); the gate calls
  // it, so a bare test app must stub it or the 403 path would 500 instead.
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => false) as typeof req.isAuthenticated;
    next();
  });
  app.use("/api", errorReportRouter);
  app.use("/api", cspReportRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test("unauthenticated GET /api/v1/error-reports/audit is refused (403)", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/v1/error-reports/audit`);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "ops scope required");
  });
});

test("unauthenticated GET /api/v1/csp-report/audit is refused (403)", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/v1/csp-report/audit`);
    assert.equal(res.status, 403);
  });
});

test("x-admin-token grants the error-reports audit (200, shaped)", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/v1/error-reports/audit`, {
      headers: { "x-admin-token": ADMIN_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      totalReports?: number;
      reports?: unknown[];
    };
    assert.equal(typeof body.totalReports, "number");
    assert.ok(Array.isArray(body.reports));
  });
});

test("a wrong x-admin-token is still refused (403), not treated as valid", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/v1/csp-report/audit`, {
      headers: { "x-admin-token": "not-the-token" },
    });
    assert.equal(res.status, 403);
  });
});

test("ingestion POST /api/v1/error-reports remains open to unauthenticated beacons (201)", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/v1/error-reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        errorName: "TestError",
        errorMessage: "gate test",
        url: "https://example.test/menu",
        sessionReplayTrace: [],
      }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { ok?: boolean };
    assert.equal(body.ok, true);
  });
});
