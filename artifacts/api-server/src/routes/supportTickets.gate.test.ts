import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

// Route modules reach @workspace/db, which throws at import time unless a
// DATABASE_URL exists. Set it before a DYNAMIC import: static `import` is
// hoisted and would run before this assignment. These cases stay DB-free —
// the gate denies an unauthenticated caller before any query is issued.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";
const { default: router } = await import("./supportTickets");


test("supportTickets.ts gated endpoints return 403 when unauthenticated", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => false) as any;
    req.log = { info() {}, warn() {}, error() {} } as any;
    next();
  });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
    {
      const res = await fetch(`${base}/support-tickets`, { method: "GET" });
      assert.equal(res.status, 403, "GET /support-tickets should be gated");
    }
    {
      const res = await fetch(`${base}/support-tickets/metrics`, { method: "GET" });
      assert.equal(res.status, 403, "GET /support-tickets/metrics should be gated");
    }
    {
      const res = await fetch(`${base}/support-tickets/rejected`, { method: "GET" });
      assert.equal(res.status, 403, "GET /support-tickets/rejected should be gated");
    }
    {
      const res = await fetch(`${base}/support-tickets/123`, { method: "GET" });
      assert.equal(res.status, 403, "GET /support-tickets/:id should be gated");
    }
  } finally {
    server.close();
  }
});
