import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, ordersTable } from "@workspace/db";
import { runOrderReconciliationSweep } from "./reconciliationScheduler";

process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_rec";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test_rec";

const RUN = randomUUID().slice(0, 8);
const userId = `u_rec_${RUN}`;
const orderIds: number[] = [];

after(async () => {
  if (orderIds.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, orderIds));
  }
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

test("setup user for reconciliation tests", async () => {
  await db.insert(usersTable).values({
    id: userId,
    phoneE164: `+910000000000`,
    firstName: "Recon",
    lastName: "Tester",
  });
});

test("runOrderReconciliationSweep reconciles stale placed orders with captured payments", async () => {
  const now = new Date();
  const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
  const rzpOrderId = `order_rzp_${RUN}`;

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "placed",
      totalPaise: 25000,
      chargePaise: 25000,
      razorpayOrderId: rzpOrderId,
      createdAt: twentyMinutesAgo,
      items: [],
      orderKind: "meal",
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);

  const fakeFetch = async (url: any) => {
    if (String(url).includes(`api.razorpay.com/v1/orders/${rzpOrderId}/payments`)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: `pay_rec_${RUN}`, status: "captured", amount: 25000 },
          ],
        }),
      } as unknown as Response;
    }
    return { ok: false, status: 404 } as unknown as Response;
  };

  const res = await runOrderReconciliationSweep({ now, fetchFn: fakeFetch as any });
  assert.equal(res.reconciled, 1);
  assert.equal(res.errors, 0);

  const [updatedOrder] = await db
    .select({ status: ordersTable.status, payId: ordersTable.razorpayPaymentId })
    .from(ordersTable)
    .where(eq(ordersTable.id, order!.id));

  assert.equal(updatedOrder?.status, "preparing");
  assert.equal(updatedOrder?.payId, `pay_rec_${RUN}`);
});

test("runOrderReconciliationSweep ignores orders newer than 15 minutes", async () => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const rzpOrderId = `order_recent_${RUN}`;

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "placed",
      totalPaise: 15000,
      chargePaise: 15000,
      razorpayOrderId: rzpOrderId,
      createdAt: fiveMinutesAgo,
      items: [],
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);

  const res = await runOrderReconciliationSweep({ now, fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ items: [{ id: "pay_x", status: "captured" }] }) }) as any });
  assert.equal(res.reconciled, 0);

  const [checkOrder] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, order!.id));
  assert.equal(checkOrder?.status, "placed");
});
