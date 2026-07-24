/**
 * DB-backed coverage for the gift-voucher redeem path (routes/corporate.ts) —
 * which had ZERO CI coverage. The money-critical behaviour: redeeming a voucher
 * flips it active→redeemed EXACTLY ONCE and credits the redeemer's credit-ledger
 * wallet by amountPaise (the balance finalizeOrder auto-applies at checkout).
 *
 * NOTE (escalated separately, out of scope here): buying a voucher (POST
 * /vouchers) currently mints a funded card WITHOUT charging the buyer — whether
 * Wave G wants a buyer-charged purchase is a product decision.
 *
 * Harness mirrors subscriptions.creditLedger.test.ts (x-test-user-id auth stub +
 * makeUser + api()). Run:
 *   node --test --import tsx ./src/routes/vouchers.test.ts
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
import { inArray } from "drizzle-orm";
import { db, usersTable, vouchersTable, creditLedgerTable } from "@workspace/db";
import { getCreditBalancePaise } from "../lib/loyaltyEngine";

import corporateRouter from "./corporate";

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
  // vouchers.purchasedByUserId / redeemedByUserId are SET NULL on user delete
  // (rows survive), so delete the voucher rows explicitly; credit_ledger
  // cascades but we delete it first for tidiness.
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(creditLedgerTable)
      .where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
  }
  if (CREATED_VOUCHER_IDS.length > 0) {
    await db.delete(vouchersTable).where(inArray(vouchersTable.id, CREATED_VOUCHER_IDS));
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
  const res = await fetch(`${baseUrl}${path}`, {
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

async function mintVoucher(buyer: TestUser, amountPaise: number): Promise<string> {
  const res = await api("POST", "/vouchers", { amountPaise }, buyer);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.voucher.status, "active");
  CREATED_VOUCHER_IDS.push(res.json.voucher.id);
  return res.json.voucher.code as string;
}

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
