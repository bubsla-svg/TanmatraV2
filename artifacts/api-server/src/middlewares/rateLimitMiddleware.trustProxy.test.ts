/**
 * Regression test for the shared-bucket rate-limit bug (app.ts's
 * `trust proxy`): the real topology is TWO trusted hops — GCLB in front of
 * the storefront, then the storefront's own `/api/:path*` rewrite, which is
 * a second, separate request into this service, not a transparent
 * pass-through. `trust proxy: 1` only skips ONE hop from the right, so
 * `req.ip` resolved to the SECOND-closest X-Forwarded-For entry — the
 * storefront's own (shared, low-cardinality) address — instead of the actual
 * visitor's. Every real customer collapsed onto that handful of shared
 * addresses and shared one rate-limit bucket.
 *
 * This reproduces the exact 2-entry XFF chain a request takes on its way
 * here (`<client ip>, <storefront hop ip>`) against two app instances: one
 * with the OLD `trust proxy: 1` (proves the bug), one with the FIXED
 * `trust proxy: 2` (proves the fix) — both hitting the SAME shared
 * Postgres-backed limiter, so this is the same collision the shared bucket
 * caused in production, not a mocked approximation of it.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/middlewares/rateLimitMiddleware.trustProxy.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express } from "express";

import { rateLimitMiddleware } from "./rateLimitMiddleware";

const STOREFRONT_HOP_IP = "10.0.0.7"; // every request shares this — the storefront's own rewrite hop

function makeApp(trustProxy: number, scope: string): Express {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.get("/probe", rateLimitMiddleware(scope, 3, 60_000), (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

async function listen(app: Express): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

async function hitAsClient(baseUrl: string, realClientIp: string): Promise<number> {
  const res = await fetch(`${baseUrl}/probe`, {
    headers: { "x-forwarded-for": `${realClientIp}, ${STOREFRONT_HOP_IP}` },
  });
  return res.status;
}

test("trust proxy: 1 (the old, buggy value) collapses distinct clients into one shared bucket", async () => {
  const scope = `test:trustproxy1:${Date.now()}`;
  const { server, baseUrl } = await listen(makeApp(1, scope));
  try {
    const clientA = "203.0.113.11";
    const clientB = "203.0.113.22";
    // Same 2-hop chain, DIFFERENT real client IPs. With trust proxy: 1, req.ip
    // resolves to the last trusted-skip entry — the shared storefront hop —
    // so these two distinct visitors land in the SAME bucket.
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push(await hitAsClient(baseUrl, clientA));
    // Client A alone already used the scope's full budget (max: 3). A totally
    // different client, sharing only the storefront hop, should NOT be
    // affected by that — but under the bug, it is.
    const clientBStatus = await hitAsClient(baseUrl, clientB);
    assert.equal(
      clientBStatus,
      429,
      "bug reproduction: a different real client got rate-limited by client A's usage under trust proxy:1",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("trust proxy: 2 (the fix) gives distinct clients their own separate buckets", async () => {
  const scope = `test:trustproxy2:${Date.now()}`;
  const { server, baseUrl } = await listen(makeApp(2, scope));
  try {
    const clientA = "203.0.113.33";
    const clientB = "203.0.113.44";
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push(await hitAsClient(baseUrl, clientA));
    assert.deepEqual(new Set(statuses), new Set([200]), "client A's own 3 requests should all succeed");

    // Client A is now at its budget; a THIRD request from A should 429.
    assert.equal(await hitAsClient(baseUrl, clientA), 429, "client A's 4th request exceeds its own budget");

    // A different real client, sharing only the storefront hop, must be
    // completely unaffected — this is the actual fix under test.
    assert.equal(
      await hitAsClient(baseUrl, clientB),
      200,
      "a different real client must get its own fresh budget, not inherit client A's",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
