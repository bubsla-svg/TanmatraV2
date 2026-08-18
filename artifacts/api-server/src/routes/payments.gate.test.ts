import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

// Route modules reach @workspace/db, which throws at import time unless a
// DATABASE_URL exists. Set it before a DYNAMIC import: static `import` is
// hoisted and would run before this assignment. These cases stay DB-free —
// the gate denies an unauthenticated caller before any query is issued.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";
const { default: router } = await import("./payments");


test("payments.ts gated endpoints return 403 when unauthenticated", async () => {
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
      const res = await fetch(`${base}/payments/charge-mandate`, { method: "POST" });
      assert.equal(res.status, 403, "POST /payments/charge-mandate should be gated");
    }
    {
      // This route, unlike the one above, carries `paymentRateLimit` directly
      // on its own definition, so the limiter runs BEFORE the auth gate — the
      // same ordering app.ts uses deliberately ("mounted before authMiddleware
      // so unauthenticated scraping is also limited").
      //
      // paymentRateLimit fails CLOSED, and the DSN at the top of this file
      // points nowhere, so here the limiter refuses first and the answer is 429
      // rather than the gate's 403. Both are refusals and neither reaches the
      // handler, which is the property this case exists to hold — so assert
      // "refused by one of the two walls" rather than pinning whichever wall
      // happens to be in front. Pinning 403 here would either fail whenever the
      // limiter cannot reach its store, or force the limiter back to fail-open
      // on a money route to keep a test green.
      const res = await fetch(`${base}/jobs/pre-debit-notifications`, { method: "POST" });
      assert.ok(
        res.status === 403 || res.status === 429,
        `POST /jobs/pre-debit-notifications should be refused, got ${res.status}`,
      );
    }
  } finally {
    server.close();
  }
});
