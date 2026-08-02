import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router from "./menuEngineering";

test("menuEngineering.ts gated endpoints return 403 when unauthenticated", async () => {
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
      const res = await fetch(`${base}/menu-engineering/run`, { method: "POST" });
      assert.equal(res.status, 403, "POST /menu-engineering/run should be gated");
    }
    {
      const res = await fetch(`${base}/dish-reviews-mod`, { method: "GET" });
      assert.equal(res.status, 403, "GET /dish-reviews-mod should be gated");
    }
  } finally {
    server.close();
  }
});
