/**
 * Audit-write contract for the /ops router (ADM-03/ADM-08).
 *
 * Separate from ops.test.ts — and from the money-unit job — because this is the
 * one /ops assertion that genuinely needs Postgres: it fires a real mutation and
 * then reads audit_log back. ops.test.ts stays DB-free (the gate denies before a
 * query is ever issued), which is why that file can live in money-unit while
 * this one runs in money-integration against a real database.
 *
 * A gate test proving a 403 says nothing about whether an ALLOWED call records
 * who did it. That gap is exactly how an earlier audit change shipped writing
 * zero rows while its own test passed, so the assertion here uses the real
 * x-admin-token identity shape rather than a manufactured req.user.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { eq, desc } from "drizzle-orm";

process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@localhost:5432/tanmatra_test";

const { db, auditLogTable } = await import("@workspace/db");
const { default: opsRouter } = await import("./ops");

const ADMIN_TOKEN = "test-ops-token-opsaudit";

test("a successful mutating /ops call writes an audit_log row", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => false) as typeof req.isAuthenticated;
    next();
  });
  app.use("/ops", opsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/ops/anomalies/scan`, {
      method: "POST",
      body: "{}",
      headers: { "x-admin-token": ADMIN_TOKEN, "Content-Type": "application/json" },
    });
    assert.equal(res.status, 200, "mutating endpoint should succeed for an ops caller");

    // audit() is deliberately fire-and-forget so a logging failure can never
    // block the response — so poll rather than assuming it has landed.
    let row: typeof auditLogTable.$inferSelect | undefined;
    for (let attempt = 0; attempt < 20 && !row; attempt++) {
      [row] = await db
        .select()
        .from(auditLogTable)
        .where(eq(auditLogTable.action, "ops.anomalies_scan"))
        .orderBy(desc(auditLogTable.createdAt))
        .limit(1);
      if (!row) await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(row, "an audit_log row should be written for ops.anomalies_scan");
    assert.equal(row.actorRole, "ops");
    assert.equal(row.resourceType, "anomaly");
    assert.equal(row.actorId, "admin-token", "operator identity comes from the gate, not req.user");
  } finally {
    server.close();
  }
});
