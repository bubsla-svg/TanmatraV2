/**
 * /compliance/logs — role gate, lazy seed-if-empty, immutability, and the
 * no-message-leak contract.
 *
 * The route previously caught its own DB errors with
 * `res.status(500).json({ error: err.message })`, echoing raw driver/SQL
 * text to the client. It also never seeded, so the compliance console had
 * zero rows in a fresh environment. Both are fixed by delegating to the
 * shared `sendError` and `seedComplianceLogsIfEmpty` helpers; this suite
 * pins both.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@localhost:5432/tanmatra_test";

const { db, complianceLogsTable } = await import("@workspace/db");
const { default: complianceRouter } = await import("./compliance");

const ADMIN_TOKEN = "test-compliance-token";

async function withApp(fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => false) as typeof req.isAuthenticated;
    next();
  });
  app.use(complianceRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test.beforeEach(async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await db.delete(complianceLogsTable);
});

test("unauthenticated GET /compliance/logs is refused (403)", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/compliance/logs`);
    assert.equal(res.status, 403);
  });
});

test("a granted caller on an empty table gets seeded rows, not an empty list", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/compliance/logs`, {
      headers: { "x-admin-token": ADMIN_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; logs: unknown[] };
    assert.equal(body.ok, true);
    assert.equal(body.logs.length, 30, "seedComplianceLogsIfEmpty should have inserted 30 days");
  });
});

test("seeding is idempotent — a second call does not duplicate rows", async () => {
  await withApp(async (base) => {
    await fetch(`${base}/compliance/logs`, { headers: { "x-admin-token": ADMIN_TOKEN } });
    const res = await fetch(`${base}/compliance/logs`, { headers: { "x-admin-token": ADMIN_TOKEN } });
    const body = (await res.json()) as { logs: unknown[] };
    assert.equal(body.logs.length, 30);
  });
});

test("POST/PUT/PATCH/DELETE on compliance logs are rejected as immutable (403), table untouched", async () => {
  await withApp(async (base) => {
    const before = await db.select().from(complianceLogsTable);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const path = method === "POST" ? "/compliance/logs" : "/compliance/logs/1";
      const res = await fetch(`${base}${path}`, { method });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    const after = await db.select().from(complianceLogsTable);
    assert.equal(after.length, before.length, "immutability rejections must not seed or mutate the table");
  });
});
