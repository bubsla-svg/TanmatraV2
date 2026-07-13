/**
 * Integration tests for the DPDP consent gate on POST /orders (5.3).
 *
 *   1. An order with no consent block is refused (400 consent_required).
 *   2. An order with consent.accepted === false is refused.
 *   3. A valid consent block passes the gate (the request then proceeds to the
 *      next check — here an unserviceable pincode 422, proving consent passed).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.consent.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express, type Request, type Response, type NextFunction } from "express";
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
  app.use(checkoutRouter);
  return app;
}

async function placeOrder(body: unknown) {
  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function baseOrder(extra: Record<string, unknown>) {
  return {
    externalOrderId: `ord-consent-${randomUUID()}`,
    items: [{ dishId: 1, qty: 1 }],
    phone: "9999999999",
    address: { line1: "1 Test Rd", city: "Noida", pincode: "000000" }, // unserviceable
    ...extra,
  };
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("order without consent is refused (400 consent_required)", async () => {
  const res = await placeOrder(baseOrder({}));
  assert.equal(res.status, 400);
  assert.equal(res.json.code, "consent_required");
});

test("order with consent.accepted=false is refused", async () => {
  const res = await placeOrder(baseOrder({ consent: { accepted: false, policyVersion: "dpdp-v1" } }));
  assert.equal(res.status, 400);
  assert.equal(res.json.code, "consent_required");
});

test("valid consent passes the gate (proceeds to the next check)", async () => {
  const res = await placeOrder(baseOrder({ consent: { accepted: true, policyVersion: "dpdp-v1" } }));
  // Consent accepted → the gate is passed; the request now fails later on the
  // deliberately-unserviceable pincode, proving consent no longer blocks it.
  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "unserviceable_pincode");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
});
