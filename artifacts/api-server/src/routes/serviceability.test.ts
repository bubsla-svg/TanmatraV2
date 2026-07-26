/**
 * Integration tests for GET /serviceability/:pincode and checkout gate authority preservation (OB-1 / II.2).
 *
 * Assertions:
 *   1. 400 on malformed input (5 digits, alphanumeric).
 *   2. Serviceable pincode resolves to 200 { serviceable: true }.
 *   3. Unserviceable pincode resolves to 200 { serviceable: false, code: "unserviceable_pincode" }.
 *   4. Checkout gate authority unaltered: POST /orders independently rejects unserviceable pincode with 422.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/serviceability.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import serviceabilityRouter from "./serviceability";
import checkoutRouter from "./checkout";

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: Record<string, (...a: unknown[]) => void> }).log = {
      error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
  app.use(serviceabilityRouter);
  app.use(checkoutRouter);
  return app;
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("GET /serviceability/20130 rejects 5 digits as 400 malformed", async () => {
  const res = await fetch(`${baseUrl}/serviceability/20130`);
  assert.equal(res.status, 400);
  const json = await res.json() as { error?: string };
  assert.equal(json.error, "invalid pincode format");
});

test("GET /serviceability/20130a rejects alphanumeric as 400 malformed", async () => {
  const res = await fetch(`${baseUrl}/serviceability/20130a`);
  assert.equal(res.status, 400);
  const json = await res.json() as { error?: string };
  assert.equal(json.error, "invalid pincode format");
});

test("GET /serviceability/201301 returns 200 { serviceable: true } for Noida core", async () => {
  const res = await fetch(`${baseUrl}/serviceability/201301`);
  assert.equal(res.status, 200);
  const json = await res.json() as { serviceable?: boolean; code?: string };
  assert.deepEqual(json, { serviceable: true });
});

test("GET /serviceability/999999 returns 200 { serviceable: false, code: 'unserviceable_pincode' } for out-of-bounds", async () => {
  const res = await fetch(`${baseUrl}/serviceability/999999`);
  assert.equal(res.status, 200);
  const json = await res.json() as { serviceable?: boolean; code?: string };
  assert.deepEqual(json, { serviceable: false, code: "unserviceable_pincode" });
});

test("checkout's own gate remains the authority: POST /orders independently rejects unserviceable pincode with 422", async () => {
  const orderBody = {
    externalOrderId: `ord-svc-authority-${randomUUID()}`,
    items: [{ dishId: 1, qty: 1 }],
    phone: "9999999999",
    address: { line1: "1 Test Rd", city: "Noida", pincode: "999999" },
    consent: { accepted: true, policyVersion: "dpdp-v1" },
  };

  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody),
  });
  assert.equal(res.status, 422);
  const json = await res.json() as { error?: string; code?: string };
  assert.equal(json.code, "unserviceable_pincode");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
});
