/**
 * Verifies the /api/payments mount's webhook exemption (OA-QUICK-1.1):
 * the Razorpay webhook path must bypass paymentRateLimit entirely, while
 * every other /api/payments route must still be limited exactly as before.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/middlewares/rateLimitMiddleware.webhookExemption.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express } from "express";

import { paymentRouteRateLimit } from "./rateLimitMiddleware";

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.set("trust proxy", true);
  app.use("/api/payments", paymentRouteRateLimit);
  app.get("/api/payments/razorpay/webhook", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/api/payments/initiate", (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

async function hit(path: string, fakeIp: string): Promise<number> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-forwarded-for": fakeIp },
  });
  return res.status;
}

before(async () => {
  const app = makeApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Each test uses its own fake source IP (via X-Forwarded-For, honored
// because the test app sets "trust proxy") so the shared Postgres-backed
// limiter's per-IP counter can never collide across tests. The counter makes
// IPs unique WITHIN a run — random draws from one /24 collide ~0.4% of the
// time, which is how aiHardening.test.ts went red in CI (`19 !== 20`). The
// random per-process base keeps rapid re-runs against a persistent dev DB from
// reusing last run's still-in-window counters. CGNAT space (100.64/10), so it
// parses as an IP but can never be a real client.
const fakeIpBase = `100.${64 + Math.floor(Math.random() * 64)}.${Math.floor(Math.random() * 256)}`;
let nextFakeIpHost = 1;
function uniqueFakeIp(): string {
  return `${fakeIpBase}.${nextFakeIpHost++}`;
}

test("razorpay webhook path bypasses paymentRateLimit even past 10 requests/min", async () => {
  const fakeIp = uniqueFakeIp();
  const statuses: number[] = [];
  for (let i = 0; i < 15; i++) {
    statuses.push(await hit("/api/payments/razorpay/webhook", fakeIp));
  }
  assert.deepEqual(
    new Set(statuses),
    new Set([200]),
    `expected all 15 webhook calls to succeed unthrottled, got: ${statuses.join(",")}`,
  );
});

test("a non-webhook /api/payments route is still rate-limited at 10/min", async () => {
  const fakeIp = uniqueFakeIp();
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    statuses.push(await hit("/api/payments/initiate", fakeIp));
  }
  const okCount = statuses.filter((s) => s === 200).length;
  const limitedCount = statuses.filter((s) => s === 429).length;
  assert.equal(okCount, 10, `expected exactly 10 of 12 calls to succeed, got statuses: ${statuses.join(",")}`);
  assert.equal(limitedCount, 2, `expected the last 2 calls to be 429, got statuses: ${statuses.join(",")}`);
});
