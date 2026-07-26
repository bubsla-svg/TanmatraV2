/**
 * DB-backed money-path coverage for gift vouchers (routes/corporate.ts).
 *
 * A voucher is bearer money: redeeming one writes `amountPaise` straight into
 * credit_ledger, which checkout spends like cash. This file pins BOTH halves of
 * that:
 *
 *   1. MINTING (MP-1 regression). POST /vouchers used to insert a row with
 *      status "active" for a client-supplied amount and NO Razorpay call —
 *      anyone authenticated could mint Rs 50,000 of spendable credit per
 *      request. It now opens a gateway order for exactly that amount, leaves a
 *      worthless `pending_payment` row, withholds the code, and funds the
 *      voucher only from POST /vouchers/verify's HMAC-checked guarded UPDATE.
 *      The tests below assert every one of those properties, plus that a
 *      pending voucher is invisible (mine/preview) and unspendable (redeem).
 *
 *   2. REDEEMING. Redeeming flips active→redeemed EXACTLY ONCE and credits the
 *      redeemer's credit-ledger wallet by amountPaise (the balance
 *      finalizeOrder auto-applies at checkout).
 *
 * Razorpay is shimmed at globalThis.fetch (no real gateway / secret needed),
 * mirroring premium.paymentOrder.test.ts. Harness (x-test-user-id auth stub +
 * makeUser + api()) mirrors subscriptions.creditLedger.test.ts. Run:
 *   node --test --import tsx ./src/routes/vouchers.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, vouchersTable, creditLedgerTable } from "@workspace/db";
import { getCreditBalancePaise } from "../lib/loyaltyEngine";

import corporateRouter from "./corporate";

const KEY_ID = "rzp_test_voucher";
const KEY_SECRET = "secret_voucher_test";
process.env["RAZORPAY_KEY_ID"] = KEY_ID;
process.env["RAZORPAY_KEY_SECRET"] = KEY_SECRET;
const RUN = randomUUID().slice(0, 8);

// --- Razorpay fetch shim: intercept api.razorpay.com only; record order amounts.
const realFetch = globalThis.fetch;
let orderSeq = 0;
const rzpOrders: Array<{ id: string; amount: number; receipt: string }> = [];
function jsonResponse(obj: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  } as unknown as Response;
}
globalThis.fetch = (async (input: any, init?: any) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input?.url ?? String(input));
  const method = (init?.method || "GET").toUpperCase();
  if (url.includes("api.razorpay.com")) {
    if (url.endsWith("/v1/orders") && method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const id = `order_vou_${++orderSeq}_${RUN}`;
      rzpOrders.push({ id, amount: body.amount, receipt: body.receipt });
      return jsonResponse({ id, amount: body.amount, currency: body.currency });
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "unhandled rzp mock route", url }),
      text: async () => "",
    } as unknown as Response;
  }
  return realFetch(input, init);
}) as typeof fetch;

interface TestUser {
  id: string;
}
const REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
  app.use(corporateRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_VOUCHER_IDS: number[] = [];

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  globalThis.fetch = realFetch;
  // vouchers.purchasedByUserId / redeemedByUserId are SET NULL on user delete
  // (rows survive), so delete the voucher rows explicitly; credit_ledger
  // cascades but we delete it first for tidiness.
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(creditLedgerTable)
      .where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
  }
  if (CREATED_VOUCHER_IDS.length > 0) {
    await db
      .delete(vouchersTable)
      .where(inArray(vouchersTable.id, CREATED_VOUCHER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function api(
  method: string,
  path: string,
  body: unknown,
  user?: TestUser,
): Promise<{ status: number; json: any }> {
  const res = await realFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user-id": user.id } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function makeUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `voucher-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  const u = { id };
  REGISTRY.set(id, u);
  return u;
}

/** Razorpay's client-side signature: HMAC-SHA256("<orderId>|<paymentId>", key_secret). */
function sign(orderId: string, paymentId: string): string {
  return createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

async function voucherRow(id: number) {
  const [row] = await db
    .select()
    .from(vouchersTable)
    .where(eq(vouchersTable.id, id))
    .limit(1);
  return row ?? null;
}

/** Opens checkout only — the voucher is left unpaid and worthless. */
async function startCheckout(
  buyer: TestUser,
  amountPaise: number,
  extra: Record<string, unknown> = {},
): Promise<{ voucherId: number; razorpayOrderId: string; json: any }> {
  const res = await api(
    "POST",
    "/vouchers",
    { amountPaise, ...extra },
    buyer,
  );
  assert.equal(res.status, 200, JSON.stringify(res.json));
  CREATED_VOUCHER_IDS.push(res.json.voucherId);
  return {
    voucherId: res.json.voucherId,
    razorpayOrderId: res.json.razorpayOrderId,
    json: res.json,
  };
}

/**
 * Mints a SPENDABLE voucher the only way one can now exist: checkout, then a
 * verified capture. Returns the code, which the server discloses only here.
 */
async function mintVoucher(
  buyer: TestUser,
  amountPaise: number,
): Promise<string> {
  const { razorpayOrderId } = await startCheckout(buyer, amountPaise);
  const paymentId = `pay_vou_${razorpayOrderId}`;
  const verify = await api(
    "POST",
    "/vouchers/verify",
    {
      razorpayPaymentId: paymentId,
      razorpayOrderId,
      razorpaySignature: sign(razorpayOrderId, paymentId),
    },
    buyer,
  );
  assert.equal(verify.status, 200, JSON.stringify(verify.json));
  assert.equal(verify.json.voucher.status, "active");
  return verify.json.voucher.code as string;
}

// ---------- MP-1: minting requires a captured payment ----------

test("POST /vouchers opens a gateway order for the asked amount, discloses NO code, and leaves the voucher unfunded", async () => {
  const buyer = await makeUser("mp1buyer");
  const AMOUNT = 250000;
  const ordersBefore = rzpOrders.length;
  const { voucherId, json } = await startCheckout(buyer, AMOUNT, {
    recipientEmail: "Friend@Example.Test",
  });

  // The gateway was actually called, for exactly the amount asked for.
  assert.equal(rzpOrders.length, ordersBefore + 1, "checkout must call Razorpay");
  assert.equal(
    rzpOrders.at(-1)!.amount,
    AMOUNT,
    "the gateway order must be opened for the voucher's denomination",
  );
  assert.equal(rzpOrders.at(-1)!.receipt, `voucher-${voucherId}`);
  assert.equal(json.keyId, KEY_ID);
  assert.equal(json.amount, AMOUNT);
  assert.equal(json.currency, "INR");

  // The response carries nothing but what the checkout modal needs — in
  // particular no voucher row and no code.
  assert.deepEqual(
    Object.keys(json).sort(),
    ["amount", "currency", "keyId", "razorpayOrderId", "voucherId"],
    "checkout must not return the voucher row",
  );

  const row = await voucherRow(voucherId);
  assert.equal(row!.status, "pending_payment", "an unpaid voucher is worthless");
  assert.equal(row!.razorpayOrderId, json.razorpayOrderId);
  assert.equal(row!.razorpayPaymentId, null);
  assert.equal(row!.recipientEmail, "friend@example.test");
  assert.ok(
    !JSON.stringify(json).includes(row!.code),
    "the code must never appear in a pre-payment response",
  );
});

test("an unpaid voucher is invisible and unspendable even to someone holding its code", async () => {
  const buyer = await makeUser("mp1pending");
  const thief = await makeUser("mp1thief");
  const { voucherId } = await startCheckout(buyer, 500000);
  // Read the code straight from the DB — i.e. assume the attacker somehow
  // already knows it. It must still buy them nothing.
  const code = (await voucherRow(voucherId))!.code;

  const preview = await api("POST", "/vouchers/preview", { code });
  assert.equal(preview.status, 404, "preview must not confirm an unpaid code");

  const redeem = await api("POST", "/vouchers/redeem", { code }, thief);
  assert.equal(redeem.status, 404, "an unpaid voucher must not be redeemable");
  assert.equal(redeem.json.error, "not_found");
  assert.equal(
    await getCreditBalancePaise(thief.id),
    0,
    "no wallet credit may come from an unpaid voucher",
  );

  const mine = await api("GET", "/vouchers/mine", undefined, buyer);
  assert.equal(mine.status, 200);
  assert.ok(
    !mine.json.purchased.some((v: any) => v.id === voucherId),
    "an abandoned checkout must not be listed as a gift card",
  );

  assert.equal((await voucherRow(voucherId))!.status, "pending_payment");
});

test("a forged signature cannot fund a voucher (400) and the row stays pending_payment", async () => {
  const buyer = await makeUser("mp1forge");
  const { voucherId, razorpayOrderId } = await startCheckout(buyer, 100000);

  const verify = await api(
    "POST",
    "/vouchers/verify",
    {
      razorpayPaymentId: "pay_forged",
      razorpayOrderId,
      razorpaySignature: "deadbeef".repeat(8), // not a valid HMAC
    },
    buyer,
  );
  assert.equal(verify.status, 400, JSON.stringify(verify.json));

  const row = await voucherRow(voucherId);
  assert.equal(row!.status, "pending_payment", "a bad signature must NOT fund");
  assert.equal(row!.razorpayPaymentId, null);
});

test("a captured payment funds the voucher exactly once — replaying the signature is 409", async () => {
  const buyer = await makeUser("mp1replay");
  const { voucherId, razorpayOrderId } = await startCheckout(buyer, 100000);
  const paymentId = `pay_vou_${razorpayOrderId}`;
  const signature = sign(razorpayOrderId, paymentId);
  const payload = {
    razorpayPaymentId: paymentId,
    razorpayOrderId,
    razorpaySignature: signature,
  };

  const first = await api("POST", "/vouchers/verify", payload, buyer);
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.voucher.status, "active");
  assert.ok(first.json.voucher.code, "the code is disclosed only after capture");

  const replay = await api("POST", "/vouchers/verify", payload, buyer);
  assert.equal(replay.status, 409, "a replayed capture must fund nothing");

  const row = await voucherRow(voucherId);
  assert.equal(row!.status, "active");
  assert.equal(row!.razorpayPaymentId, paymentId);
});

test("a valid signature for someone else's order cannot fund that voucher (409)", async () => {
  const buyer = await makeUser("mp1owner");
  const outsider = await makeUser("mp1outsider");
  const { voucherId, razorpayOrderId } = await startCheckout(buyer, 100000);
  const paymentId = `pay_vou_${razorpayOrderId}`;

  // The signature is genuinely valid — the guard that stops this is the
  // purchaser scope on the UPDATE, not the HMAC.
  const stolen = await api(
    "POST",
    "/vouchers/verify",
    {
      razorpayPaymentId: paymentId,
      razorpayOrderId,
      razorpaySignature: sign(razorpayOrderId, paymentId),
    },
    outsider,
  );
  assert.equal(stolen.status, 409, JSON.stringify(stolen.json));
  assert.equal((await voucherRow(voucherId))!.status, "pending_payment");
});

test("with no gateway configured the purchase is refused (503) — never a free voucher", async () => {
  const buyer = await makeUser("mp1nogw");
  const savedId = process.env["RAZORPAY_KEY_ID"];
  const savedSecret = process.env["RAZORPAY_KEY_SECRET"];
  let res: { status: number; json: any };
  try {
    delete process.env["RAZORPAY_KEY_ID"];
    delete process.env["RAZORPAY_KEY_SECRET"];
    res = await api("POST", "/vouchers", { amountPaise: 100000 }, buyer);
  } finally {
    process.env["RAZORPAY_KEY_ID"] = savedId!;
    process.env["RAZORPAY_KEY_SECRET"] = savedSecret!;
  }
  assert.equal(res.status, 503, JSON.stringify(res.json));

  const rows = await db
    .select()
    .from(vouchersTable)
    .where(eq(vouchersTable.purchasedByUserId, buyer.id));
  assert.equal(rows.length, 0, "a refused purchase must write no voucher row");
});

test("buying a voucher requires auth (401) and rejects an out-of-range amount (400)", async () => {
  const buyer = await makeUser("mp1bounds");
  assert.equal((await api("POST", "/vouchers", { amountPaise: 100000 })).status, 401);
  assert.equal(
    (await api("POST", "/vouchers", { amountPaise: 9_999 }, buyer)).status,
    400,
  );
  assert.equal(
    (await api("POST", "/vouchers", { amountPaise: 5_000_001 }, buyer)).status,
    400,
  );
});

// ---------- redeeming a funded voucher ----------

test("redeem flips a voucher active→redeemed once and credits the wallet by amountPaise", async () => {
  const buyer = await makeUser("buyer");
  const redeemer = await makeUser("redeemer");
  const AMOUNT = 50000;
  const code = await mintVoucher(buyer, AMOUNT);

  const before = await getCreditBalancePaise(redeemer.id);
  const redeem = await api("POST", "/vouchers/redeem", { code }, redeemer);
  assert.equal(redeem.status, 200, JSON.stringify(redeem.json));
  assert.equal(redeem.json.creditedPaise, AMOUNT);
  assert.equal(redeem.json.voucher.status, "redeemed");
  assert.equal(redeem.json.voucher.redeemedByUserId, redeemer.id);

  const after = await getCreditBalancePaise(redeemer.id);
  assert.equal(after - before, AMOUNT, "wallet must gain exactly the voucher amount");
});

test("a voucher cannot be redeemed twice (409) and the second redeemer gains nothing", async () => {
  const buyer = await makeUser("b2");
  const first = await makeUser("r2a");
  const second = await makeUser("r2b");
  const code = await mintVoucher(buyer, 30000);

  assert.equal((await api("POST", "/vouchers/redeem", { code }, first)).status, 200);
  const dup = await api("POST", "/vouchers/redeem", { code }, second);
  assert.equal(dup.status, 409, "a redeemed voucher must be rejected");
  assert.equal(
    await getCreditBalancePaise(second.id),
    0,
    "the second redeemer's wallet must be untouched",
  );
});

test("an unknown code is 404; redeem requires auth (401)", async () => {
  const user = await makeUser("u404");
  assert.equal((await api("POST", "/vouchers/redeem", { code: "TM-NOPE-9999" }, user)).status, 404);
  assert.equal((await api("POST", "/vouchers/redeem", { code: "TM-NOPE-9999" })).status, 401);
});

test("GET /vouchers/mine lists purchased for the buyer and redeemed for the redeemer", async () => {
  const buyer = await makeUser("mineB");
  const redeemer = await makeUser("mineR");
  const code = await mintVoucher(buyer, 25000);
  const vid = CREATED_VOUCHER_IDS.at(-1);
  await api("POST", "/vouchers/redeem", { code }, redeemer);

  const buyerMine = await api("GET", "/vouchers/mine", undefined, buyer);
  assert.equal(buyerMine.status, 200);
  assert.ok(
    buyerMine.json.purchased.some((v: any) => v.id === vid),
    "buyer sees the voucher in purchased",
  );

  const redeemerMine = await api("GET", "/vouchers/mine", undefined, redeemer);
  assert.ok(
    redeemerMine.json.redeemed.some((v: any) => v.id === vid),
    "redeemer sees the voucher in redeemed",
  );
});
