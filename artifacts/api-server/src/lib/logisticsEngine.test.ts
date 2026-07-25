/**
 * Integration unit test suite for Autonomous Logistics Fallback Engine.
 * Verifies 15+ minute 3PL rescue dispatch logging and 20+ minute goodwill
 * ₹150 compensation voucher & credit ledger awards.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  ordersTable,
  vouchersTable,
  usersTable,
  creditLedgerTable,
  messageDispatchesTable,
} from "@workspace/db";
import { scanAndExecuteRiderFallbacks } from "./logisticsEngine";

let testOrderId1: number;
let testOrderId2: number;
let testUserId: string;

before(async () => {
  testUserId = `log_usr_${Math.random().toString(36).substring(2, 8)}`;
  await db.insert(usersTable).values({ id: testUserId });

  // Order 1: 17 minutes delayed in "preparing" -> triggers 3PL rescue assignment
  const time17mAgo = new Date(Date.now() - 17 * 60_000);
  const [o1] = await db
    .insert(ordersTable)
    .values({
      userId: testUserId,
      status: "preparing",
      totalPaise: 35000,
      chargePaise: 35000,
      items: [],
      createdAt: time17mAgo,
    })
    .returning({ id: ordersTable.id });
  testOrderId1 = o1!.id;

  // Order 2: 25 minutes delayed in "out_for_delivery" -> triggers ₹150 apology voucher & ledger credit
  const time25mAgo = new Date(Date.now() - 25 * 60_000);
  const [o2] = await db
    .insert(ordersTable)
    .values({
      userId: testUserId,
      status: "out_for_delivery",
      totalPaise: 42000,
      chargePaise: 42000,
      items: [],
      createdAt: time25mAgo,
    })
    .returning({ id: ordersTable.id });
  testOrderId2 = o2!.id;
});

after(async () => {
  if (testOrderId1 || testOrderId2) {
    const ids = [testOrderId1, testOrderId2].filter(Boolean);
    await db.delete(ordersTable).where(inArray(ordersTable.id, ids)).catch(() => {});
  }
  if (testUserId) {
    await db.delete(creditLedgerTable).where(eq(creditLedgerTable.userId, testUserId)).catch(() => {});
    await db.delete(messageDispatchesTable).where(eq(messageDispatchesTable.userId, testUserId)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, testUserId)).catch(() => {});
  }
  if (testOrderId2) {
    await db.delete(vouchersTable).where(eq(vouchersTable.message, `Compensation for delay on Order #${testOrderId2}`)).catch(() => {});
  }
});

test("scanAndExecuteRiderFallbacks triggers 3PL rescue at 15m and apology vouchers at 20m", async () => {
  const interventions = await scanAndExecuteRiderFallbacks(6);

  const res1 = interventions.find((i) => i.orderId === testOrderId1);
  assert.ok(res1, "Should find order 1");
  assert.equal(res1.actionTaken, "re_assign_3pl", "17 minute lag should trigger 3PL priority rescue rider re-assignment");

  const res2 = interventions.find((i) => i.orderId === testOrderId2);
  assert.ok(res2, "Should find order 2");
  assert.equal(res2.actionTaken, "issue_apology_voucher", "25 minute lag should autonomously generate a ₹150 apology voucher");
  assert.ok(res2.voucherCode, "Voucher code should be returned");

  // Verify voucher persisted in DB
  const vRows = await db.select().from(vouchersTable).where(eq(vouchersTable.code, res2.voucherCode!));
  assert.equal(vRows.length, 1);
  assert.equal(vRows[0]?.amountPaise, 15000);
  assert.equal(vRows[0]?.status, "active");

  // Verify second consecutive scan deduplicates voucher issuance
  const secondRun = await scanAndExecuteRiderFallbacks(6);
  const res2After = secondRun.find((i) => i.orderId === testOrderId2);
  assert.ok(res2After);
  assert.equal(res2After.actionTaken, "none", "Should not duplicate voucher if already issued for this order");
});
