import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { default: opsRouter } = await import("./ops");

const ADMIN_TOKEN = "test-ops-token-opsgate";

async function withApp(fn: (base: string) => Promise<void>): Promise<void> {
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
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test("unauthenticated access to mutating endpoints returns 403", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/ops/anomalies/scan`, { method: "POST", body: "{}" });
    assert.equal(res.status, 403);
  });
});

test("wrong role access to mutating endpoints returns 403", async () => {
  process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;
  await withApp(async (base) => {
    const res = await fetch(`${base}/ops/anomalies/scan`, {
      method: "POST",
      body: "{}",
      headers: { "x-admin-token": "wrong-token", "Content-Type": "application/json" },
    });
    assert.equal(res.status, 403);
  });
});
