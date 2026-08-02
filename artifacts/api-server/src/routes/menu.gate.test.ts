import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router from "./menu";

test("menu.ts gated endpoints return 403 when unauthenticated", async () => {
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
      const res = await fetch(`${base}/menu/items`, { method: "GET" });
      assert.equal(res.status, 403, "GET /menu/items should be gated");
    }
    {
      const res = await fetch(`${base}/menu/items`, { method: "POST" });
      assert.equal(res.status, 403, "POST /menu/items should be gated");
    }
    {
      const res = await fetch(`${base}/menu/items/123`, { method: "PATCH" });
      assert.equal(res.status, 403, "PATCH /menu/items/:slug should be gated");
    }
    {
      const res = await fetch(`${base}/menu/uploads`, { method: "POST" });
      assert.equal(res.status, 403, "POST /menu/uploads should be gated");
    }
    {
      const res = await fetch(`${base}/menu/items/123/image`, { method: "POST" });
      assert.equal(res.status, 403, "POST /menu/items/:slug/image should be gated");
    }
    {
      const res = await fetch(`${base}/menu/items/123/copy`, { method: "POST" });
      assert.equal(res.status, 403, "POST /menu/items/:slug/copy should be gated");
    }
    {
      const res = await fetch(`${base}/menu/copy/missing`, { method: "GET" });
      assert.equal(res.status, 403, "GET /menu/copy/missing should be gated");
    }
  } finally {
    server.close();
  }
});
