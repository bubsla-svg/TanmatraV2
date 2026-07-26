/**
 * Integration unit test suite for the Logistics Fallback Engine.
 * Delay is measured against the PROMISED time (scheduledFor, else
 * createdAt + 45-minute standard window) — never raw order age.
 * Verifies 15+ min-past 3PL rescue logging, 20+ min-past ₹150 voucher
 * (voucher ONLY — no parallel credit-ledger grant), and that a normal
 * in-window order gets nothing.
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
let testOrderId3: number;
let testUserId: string;

before(async () => {
  testUserId = `log_usr_${Math.random().toString(36).substring(2, 8)}`;
  await db.insert(usersTable).values({ id: testUserId });

  // Order 1: promised slot (scheduledFor) 17 minutes ago -> 3PL rescue band (15-19m past)
  const [o1] = await db
    .insert(ordersTable)
    .values({
      userId: testUserId,
      status: "preparing",
      totalPaise: 35000,
      chargePaise: 35000,
      items: [],
      createdAt: new Date(Date.now() - 10 * 60_000),
      scheduledFor: new Date(Date.now() - 17 * 60_000),
    })
    .returning({ id: ordersTable.id });
  testOrderId1 = o1!.id;

  // Order 2: no slot, created 70 minutes ago -> 25 minutes past the 45-minute
  // standard window -> ₹150 apology voucher
  const [o2] = await db
    .insert(ordersTable)
    .values({
      userId: testUserId,
      status: "out_for_delivery",
      totalPaise: 42000,
      chargePaise: 42000,
      items: [],
      createdAt: new Date(Date.now() - 70 * 60_000),
    })
    .returning({ id: ordersTable.id });
  testOrderId2 = o2!.id;

  // Order 3: no slot, created 25 minutes ago -> still INSIDE the standard
  // window. The first draft treated raw age as delay and would have paid
  // this normal order ₹150; it must get nothing.
  const [o3] = await db
    .insert(ordersTable)
    .values({
      userId: testUserId,
      status: "out_for_delivery",
      totalPaise: 30000,
      chargePaise: 30000,
      items: [],
      createdAt: new Date(Date.now() - 25 * 60_000),
    })
    .returning({ id: ordersTable.id });
  testOrderId3 = o3!.id;
});

after(async () => {
  const ids = [testOrderId1, testOrderId2, testOrderId3].filter(Boolean);
  if (ids.length) {
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

test("scanAndExecuteRiderFallbacks measures delay past the promised time, pays the voucher once, and leaves in-window orders alone", async () => {
  const interventions = await scanAndExecuteRiderFallbacks(6);

  // 17 minutes past the promised slot -> 3PL rescue, no money
  const res1 = interventions.find((i) => i.orderId === testOrderId1);
  assert.ok(res1, "Should find order 1");
  assert.equal(res1.actionTaken, "re_assign_3pl", "17 minutes past scheduledFor should trigger 3PL rescue re-assignment");

  // 25 minutes past the standard window -> ₹150 apology voucher
  const res2 = interventions.find((i) => i.orderId === testOrderId2);
  assert.ok(res2, "Should find order 2");
  assert.equal(res2.actionTaken, "issue_apology_voucher", "25 minutes past expected-by should generate a ₹150 apology voucher");
  assert.ok(res2.voucherCode, "Voucher code should be returned");
  assert.ok(res2.delayMinutes >= 20 && res2.delayMinutes < 45, "delay is minutes PAST expected-by, not raw order age");

  // 25-minute-old order still inside its window -> nothing. Raw age is not delay.
  const res3 = interventions.find((i) => i.orderId === testOrderId3);
  assert.ok(res3, "Should find order 3");
  assert.equal(res3.actionTaken, "none", "a normal in-window order must never be compensated");
  assert.ok(res3.delayMinutes < 0, "in-window order has negative delay vs expected-by");

  // Verify voucher persisted in DB
  const vRows = await db.select().from(vouchersTable).where(eq(vouchersTable.code, res2.voucherCode!));
  assert.equal(vRows.length, 1);
  assert.equal(vRows[0]?.amountPaise, 15000);
  assert.equal(vRows[0]?.status, "active");

  // The voucher is the ONLY grant. The first draft also wrote a direct ₹150
  // credit_ledger row alongside it (₹300 per incident); this pins its removal.
  const ledgerRows = await db
    .select()
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.userId, testUserId));
  assert.equal(ledgerRows.length, 0, "compensation must not double-pay via credit_ledger — the voucher is the grant");

  // Verify second consecutive scan deduplicates voucher issuance
  const secondRun = await scanAndExecuteRiderFallbacks(6);
  const res2After = secondRun.find((i) => i.orderId === testOrderId2);
  assert.ok(res2After);
  assert.equal(res2After.actionTaken, "none", "Should not duplicate voucher if already issued for this order");
});
