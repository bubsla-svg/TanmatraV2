import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router from "./analytics";

test("analytics.ts gated endpoints return 403 when unauthenticated", async () => {
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
      const res = await fetch(`${base}/analytics/schema`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/schema should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/ask`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/ask should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/sql`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/sql should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/queries`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/queries should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/queries/123/save`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/queries/:id/save should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/wbr`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/wbr should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/wbr/latest`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/wbr/latest should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/wbr/123`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/wbr/:id should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/wbr/generate`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/wbr/generate should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/wbr/123/publish`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/wbr/:id/publish should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/wbr/simulate`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/wbr/simulate should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/funnels`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/funnels should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/voc/themes`, { method: "GET" });
      assert.equal(res.status, 403, "GET /analytics/voc/themes should be gated");
    }
    {
      const res = await fetch(`${base}/analytics/voc/extract`, { method: "POST" });
      assert.equal(res.status, 403, "POST /analytics/voc/extract should be gated");
    }
  } finally {
    server.close();
  }
});
