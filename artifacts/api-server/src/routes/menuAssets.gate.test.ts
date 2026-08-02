import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

// Route modules reach @workspace/db, which throws at import time unless a
// DATABASE_URL exists. Set it before a DYNAMIC import: static `import` is
// hoisted and would run before this assignment. These cases stay DB-free —
// the gate denies an unauthenticated caller before any query is issued.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";
const { default: router } = await import("./menuAssets");


test("menuAssets.ts gated endpoints return 403 when unauthenticated", async () => {
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
    const res1 = await fetch(`${base}/menu/items/slug-1/assets`, { method: "GET" });
    assert.equal(res1.status, 403);
    const res2 = await fetch(`${base}/menu/items/slug-1/assets/upload`, { method: "POST" });
    assert.equal(res2.status, 403);
    const res3 = await fetch(`${base}/menu/assets/1/enhance`, { method: "POST" });
    assert.equal(res3.status, 403);
    const res4 = await fetch(`${base}/menu/items/slug-1/assets/hero`, { method: "POST" });
    assert.equal(res4.status, 403);
    const res5 = await fetch(`${base}/menu/assets/1/remove-bg`, { method: "POST" });
    assert.equal(res5.status, 403);
    const res6 = await fetch(`${base}/menu/assets/1/set-primary`, { method: "POST" });
    assert.equal(res6.status, 403);
    const res7 = await fetch(`${base}/menu/assets/1`, { method: "DELETE" });
    assert.equal(res7.status, 403);
    const res8 = await fetch(`${base}/menu/items/missing-images`, { method: "GET" });
    assert.equal(res8.status, 403);
    const res9 = await fetch(`${base}/menu/items/assets/bulk-hero`, { method: "POST" });
    assert.equal(res9.status, 403);
  } finally {
    server.close();
  }
});
