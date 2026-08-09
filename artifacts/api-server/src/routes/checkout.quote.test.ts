/**
 * Integration tests for POST /orders/quote — the read-only QuoteSnapshot the
 * à-la-carte checkout displays (UX/UI Architecture Phase 7: "Checkout must
 * consume an immutable server-owned QuoteSnapshot").
 *
 * The load-bearing case is PARITY: for the same cart, the quote's
 * payableNowPaise must equal the totalPaise POST /orders actually bills.
 * Both routes price through validateCartItems + calculateCartTotals — these
 * tests exist so that shared path can never silently fork.
 *
 * Harness mirrors checkout.premiumGate.test.ts (bare express app, x-test-user-id
 * registry auth stub). Needs DATABASE_URL (CI: money-integration job).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.quote.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { like } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { TEST_DISHES } from "../test-fixtures/dishes.js";

import checkoutRouter from "./checkout";

const RUN = randomUUID().slice(0, 8);
const EXT_PREFIX = `quote-${RUN}-`;

// Fixture dishes with known prices/availability (registered into the resolver
// catalog by the import side-effect; prices match the seeded menu_items rows).
// test-smoothie-bowl at ₹285: qty 1 stays under the ₹500 free-delivery
// threshold (delivery fee + both GST rates in play), qty 2 crosses it (free
// delivery), so the two parity/breakdown tests cover both fee branches.
const CHEAP_DISH = TEST_DISHES.find((d) => d.slug === "test-smoothie-bowl");
const PREMIUM_DISH = TEST_DISHES.find((d) => d.slug === "alfredo-pasta-prawns");
assert.ok(CHEAP_DISH, "test-smoothie-bowl fixture dish missing from TEST_DISHES");
assert.ok(PREMIUM_DISH, "premium fixture dish missing from TEST_DISHES");

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      isAuthenticated: () => boolean;
      log: Record<string, (...a: unknown[]) => void>;
    };
    r.isAuthenticated = () => false;
    r.log = {
      error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
  app.use(checkoutRouter);
  return app;
}

async function ensureServer(): Promise<void> {
  if (baseUrl) return;
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  await ensureServer();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function orderBody(items: Array<{ dishId: number; qty: number }>): Record<string, unknown> {
  return {
    externalOrderId: `${EXT_PREFIX}${randomUUID().slice(0, 12)}`,
    items,
    phone: "+919999900001",
    address: { line1: "Quote parity lane 1", city: "Noida", pincode: "201301" },
    consent: { accepted: true, policyVersion: "dpdp-2023-v1" },
    allergenAck: true,
  };
}

after(async () => {
  await db.delete(ordersTable).where(like(ordersTable.externalOrderId, `${EXT_PREFIX}%`));
  await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
});

test("quote payableNow equals the total POST /orders bills for the same cart", async () => {
  const items = [{ dishId: CHEAP_DISH!.id, qty: 2 }];

  const quote = await post("/orders/quote", { items, pincode: "201301" });
  assert.equal(quote.status, 200, JSON.stringify(quote.json));

  const created = await post("/orders", orderBody(items));
  assert.equal(created.status, 201, JSON.stringify(created.json));

  assert.equal(
    quote.json["payableNowPaise"],
    created.json["totalPaise"],
    "quoted amount and billed amount must be identical for the same cart",
  );
});

test("breakdown is internally consistent and every declared field is present", async () => {
  const r = await post("/orders/quote", { items: [{ dishId: CHEAP_DISH!.id, qty: 1 }] });
  assert.equal(r.status, 200, JSON.stringify(r.json));

  const q = r.json;
  for (const field of [
    "subtotalPaise", "deliveryFeePaise", "packagingPaise", "discountPaise",
    "taxPaise", "payableNowPaise", "amountToFreeDeliveryPaise", "etaMinutes", "expiresAt",
  ]) {
    assert.ok(field in q, `quote missing ${field}`);
  }
  const sum =
    (q["subtotalPaise"] as number) +
    (q["deliveryFeePaise"] as number) +
    (q["packagingPaise"] as number) -
    (q["discountPaise"] as number) +
    (q["taxPaise"] as number);
  assert.equal(sum, q["payableNowPaise"], "breakdown fields must sum to payableNow");
  assert.equal(q["status"], "active");

  const expires = Date.parse(String(q["expiresAt"]));
  assert.ok(expires > Date.now() + 60_000, "expiresAt must be meaningfully in the future");
});

test("serviceability reflects the shared pincode list; quote still prices", async () => {
  const ok = await post("/orders/quote", { items: [{ dishId: CHEAP_DISH!.id, qty: 1 }], pincode: "201301" });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json["serviceability"], { pincode: "201301", serviceable: true });

  const nope = await post("/orders/quote", { items: [{ dishId: CHEAP_DISH!.id, qty: 1 }], pincode: "110001" });
  assert.equal(nope.status, 200, "an unserviceable pin is a serviceability FACT, not a quote failure");
  assert.deepEqual(nope.json["serviceability"], { pincode: "110001", serviceable: false });
  assert.ok((nope.json["payableNowPaise"] as number) > 0, "quote still prices the cart");
});

test("unknown dish and guest premium cart fail with the same codes as create", async () => {
  const unknown = await post("/orders/quote", { items: [{ dishId: 999999, qty: 1 }] });
  assert.equal(unknown.status, 422);

  const premium = await post("/orders/quote", { items: [{ dishId: PREMIUM_DISH!.id, qty: 1 }] });
  assert.equal(premium.status, 403, JSON.stringify(premium.json));
  assert.equal(premium.json["code"], "premium_required");
});
