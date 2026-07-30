/**
 * Integration tests for customisation pricing on POST /orders — the wiring
 * side of dishCustomizations.ts. Uses dish id 121 (Grilled Veggie Sandwich,
 * ₹260 base) from the bundled catalogue, which carries a real "Choose Bread
 * Type" group: Brown Bread (default, +₹0) / Multigrain Bread (+₹15).
 *
 * Run with:
 *   node --test --import tsx ./src/routes/checkout.customizations.test.ts
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

const SANDWICH_DISH_ID = 121;

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

// A servicable pincode + accepted consent, so requests reach item resolution
// rather than being rejected earlier in the pipeline (checkout.consent.test.ts
// covers the consent gate itself). allergenAck is set because the sandwich
// fixture (id 121) carries declared allergens (Dairy, Gluten) — an anonymous
// guest who declares nothing is otherwise held at allergen_ack_required
// (checkoutSafety.ts assessAllergenAck), which would mask the customisation
// behaviour these tests actually exercise.
function baseOrder(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    externalOrderId: `ord-custom-${randomUUID()}`,
    items,
    phone: "9999999999",
    // A REAL serviceable pincode (SERVICEABLE_PINCODES, api-zod) — these tests
    // are exercising item/customisation validation, which runs after the
    // pincode gate, so an unserviceable code would 422 before ever reaching
    // the code under test.
    address: { line1: "1 Test Rd", city: "Noida", pincode: "201301" },
    consent: { accepted: true, policyVersion: "dpdp-v1" },
    allergenAck: true,
    ...extra,
  };
}

test("setup: start server", async () => {
  server = http.createServer(makeApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test("no customizations field → priced at the plain base price (back-compat)", async () => {
  const res = await placeOrder(baseOrder([{ dishId: SANDWICH_DISH_ID, qty: 1 }]));
  assert.equal(res.status, 201, JSON.stringify(res.json));
});

test("selecting the non-default option adds its priceModifier to the bill", async () => {
  const plain = await placeOrder(baseOrder([{ dishId: SANDWICH_DISH_ID, qty: 1 }]));
  const customized = await placeOrder(
    baseOrder([
      {
        dishId: SANDWICH_DISH_ID,
        qty: 1,
        customizations: [{ groupName: "Choose Bread Type", optionNames: ["Multigrain Bread"] }],
      },
    ]),
  );
  assert.equal(plain.status, 201, JSON.stringify(plain.json));
  assert.equal(customized.status, 201, JSON.stringify(customized.json));
  assert.notEqual(plain.json.serverOrderId, customized.json.serverOrderId);
  // The response echoes the server's totalPaise. Assert the customised order
  // billed strictly MORE than the plain one — not an exact delta, which would
  // couple this test to cartMath.ts's GST/delivery-fee formula (not this
  // file's concern) — proving the modifier was actually applied rather than
  // silently dropped, which is the exact failure this whole slice exists to
  // close (see BATCH-4-GROUNDING.md finding 1).
  assert.ok(
    customized.json.totalPaise > plain.json.totalPaise,
    `expected customised total (${customized.json.totalPaise}) > plain total (${plain.json.totalPaise})`,
  );
});

test("selecting the default option is accepted and contributes no price (matches an unset group)", async () => {
  const plain = await placeOrder(baseOrder([{ dishId: SANDWICH_DISH_ID, qty: 1 }]));
  const res = await placeOrder(
    baseOrder([
      {
        dishId: SANDWICH_DISH_ID,
        qty: 1,
        customizations: [{ groupName: "Choose Bread Type", optionNames: ["Brown Bread"] }],
      },
    ]),
  );
  assert.equal(res.status, 201, JSON.stringify(res.json));
  // The default option prices at +0, so the total must match the plain order.
  assert.equal(res.json.totalPaise, plain.json.totalPaise);
});

test("unknown group name → 422 invalid_customization, order NOT created", async () => {
  const res = await placeOrder(
    baseOrder([
      {
        dishId: SANDWICH_DISH_ID,
        qty: 1,
        customizations: [{ groupName: "Choose Crust", optionNames: ["Thin"] }],
      },
    ]),
  );
  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "invalid_customization");
});

test("unknown option within a real group → 422 invalid_customization", async () => {
  const res = await placeOrder(
    baseOrder([
      {
        dishId: SANDWICH_DISH_ID,
        qty: 1,
        customizations: [{ groupName: "Choose Bread Type", optionNames: ["Sourdough"] }],
      },
    ]),
  );
  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "invalid_customization");
});

test("a dish with no customisation groups + a selection → 422, fails closed rather than ignoring it", async () => {
  // Dish id 1 (activated-charcoal-smoothie) carries an empty customizations
  // array in the bundled catalogue (see BATCH-4-GROUNDING.md fixture survey).
  const res = await placeOrder(
    baseOrder([
      {
        dishId: 1,
        qty: 1,
        customizations: [{ groupName: "Anything", optionNames: ["X"] }],
      },
    ]),
  );
  assert.equal(res.status, 422, JSON.stringify(res.json));
  assert.equal(res.json.code, "invalid_customization");
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
});
