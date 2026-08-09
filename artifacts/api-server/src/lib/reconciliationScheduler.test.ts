import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  orderClaimsTable,
  subscriptionsTable,
  subscriptionDeliveriesTable,
} from "@workspace/db";
import {
  promoteSettledZeroChargeOrders,
  runOrderReconciliationSweep,
} from "./reconciliationScheduler";

process.env["RAZORPAY_KEY_ID"] = process.env["RAZORPAY_KEY_ID"] ?? "rzp_test_rec";
process.env["RAZORPAY_KEY_SECRET"] = process.env["RAZORPAY_KEY_SECRET"] ?? "secret_test_rec";

const RUN = randomUUID().slice(0, 8);
const userId = `u_rec_${RUN}`;
const orderIds: number[] = [];

const claimIds: number[] = [];
const subscriptionIds: number[] = [];
const otherUserIds: string[] = [];

after(async () => {
  if (claimIds.length > 0) {
    await db.delete(orderClaimsTable).where(inArray(orderClaimsTable.id, claimIds));
  }
  if (orderIds.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, orderIds));
  }
  // subscriptionDeliveriesTable rows cascade with their subscription (FK
  // onDelete: cascade), so deleting subscriptionsTable is sufficient.
  if (subscriptionIds.length > 0) {
    await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, subscriptionIds));
  }
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  if (otherUserIds.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, otherUserIds));
  }
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

// ── The guards the first draft of this sweep lacked. Each of these was a way
//    to promote an order against money we did not actually have. ──────────────

test("an `authorized`-only payment does NOT promote — the money is not captured", async () => {
  const now = new Date();
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "placed",
      totalPaise: 30000,
      chargePaise: 30000,
      razorpayOrderId: `order_auth_${RUN}`,
      createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      items: [],
      orderKind: "meal",
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);

  const res = await runOrderReconciliationSweep({
    now,
    fetchFn: (async () => ({
      ok: true,
      status: 200,
      // Authorized ≠ captured: the hold can lapse and the money never move.
      json: async () => ({ items: [{ id: `pay_auth_${RUN}`, status: "authorized", amount: 30000 }] }),
    })) as any,
  });
  assert.equal(res.reconciled, 0);
  const [row] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, order!.id));
  assert.equal(row?.status, "placed", "authorized-only must stay unpromoted");
});

test("a wrong-amount capture does NOT promote — same reconciliation rule as the webhook", async () => {
  const now = new Date();
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "placed",
      totalPaise: 100000,
      chargePaise: 100000,
      razorpayOrderId: `order_amt_${RUN}`,
      createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      items: [],
      orderKind: "meal",
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);

  const res = await runOrderReconciliationSweep({
    now,
    fetchFn: (async () => ({
      ok: true,
      status: 200,
      // ₹1 captured against a ₹1,000 order. The webhook refuses this; the
      // sweep must refuse it identically or it becomes the soft underbelly.
      json: async () => ({ items: [{ id: `pay_amt_${RUN}`, status: "captured", amount: 100 }] }),
    })) as any,
  });
  assert.equal(res.reconciled, 0);
  const [row] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, order!.id));
  assert.equal(row?.status, "placed", "a wrong-amount capture must not confirm the order");
});

test("a payment reporting no amount at all still promotes (unknown defers, per isCaptureAmountReconciled)", async () => {
  // Documented behaviour, not an accident: when either side of the
  // comparison is unknown we cannot prove a mismatch, and the guarded CAS
  // remains the backstop — mirroring the webhook's contract exactly.
  const now = new Date();
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "placed",
      totalPaise: 40000,
      chargePaise: 40000,
      razorpayOrderId: `order_noamt_${RUN}`,
      createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      items: [],
      orderKind: "meal",
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);

  const res = await runOrderReconciliationSweep({
    now,
    // URL-selective: the sweep also revisits this suite's earlier still-placed
    // orders (authorized-only, wrong-amount); answering for THEM here would
    // promote rows the previous tests assert stay unpromoted.
    fetchFn: (async (url: any) => {
      if (String(url).includes(`order_noamt_${RUN}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [{ id: `pay_noamt_${RUN}`, status: "captured" }] }),
        };
      }
      return { ok: false, status: 404 };
    }) as any,
  });
  assert.equal(res.reconciled, 1);
});

// ── Zero-charge promoter (paid-fulfilment invariant, lib/paidGate.ts). ───────
//
// The owner's "sponsored zero-charge order" scenario at the sweep level: a
// fully-settled ₹0 order must become kitchen-actionable WITHOUT any gateway
// path (payments.ts 409s on a non-positive amount), and a ₹0 minted by
// discounts alone must NOT — that is priced-free food nobody settled. The
// same settlement-evidence rule as the in-transaction finalize; assertions
// are per-row, never on the promoter's return count, because the sweep also
// visits rows other suites left in the shared database.

async function seedZeroChargeOrder(opts: {
  externalOrderId: string;
  createdAt: Date;
  ownerId?: string;
}): Promise<number> {
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId: opts.ownerId ?? userId,
      status: "placed",
      totalPaise: 25000,
      chargePaise: 0, // fully covered — by credits, subsidy, or nothing at all
      externalOrderId: opts.externalOrderId,
      createdAt: opts.createdAt,
      items: [],
      orderKind: "meal",
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);
  return order!.id;
}

async function statusOf(id: number): Promise<string> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!.status;
}

// ── Settlement Trust Boundary (docs/MONEY-PATH-VERIFICATION.md). ────────────
//
// externalOrderId is client-supplied (routes/checkout.ts and routes/loyalty.ts's
// finalizeOrderSchema both accept it verbatim, 1-64 chars, zero format
// constraint) and MUST NEVER be trusted as settlement proof on its own. The
// subscription-cycle evidence branch is a join against subscription_deliveries
// + subscriptions scoped by THIS order's own serial id and userId — neither of
// which a client can set. These tests seed a real subscription/delivery row
// (or deliberately withhold one) to prove the join, not a string, decides.

async function makeSubscriptionFor(ownerId: string): Promise<number> {
  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId: ownerId,
      cadence: "weekly",
      mealsPerDelivery: 1,
      deliveryWindow: "12:00-14:00",
      startDate: new Date(),
      nextDeliveryAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
    })
    .returning({ id: subscriptionsTable.id });
  subscriptionIds.push(sub!.id);
  return sub!.id;
}

/** Links a subscription's first cycle to `orderId`, exactly as
 *  routes/subscriptions.ts's createOrderForNewSubscription does inside the
 *  create transaction — the only writer of this column in production. */
async function linkDeliveryToOrder(subscriptionId: number, orderId: number): Promise<void> {
  await db.insert(subscriptionDeliveriesTable).values({
    subscriptionId,
    scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
    deliveryWindow: "12:00-14:00",
    status: "upcoming",
    items: [],
    orderId,
  });
}

test("a genuine subscription first-cycle order (real subscription_deliveries linkage) is promoted", async () => {
  const now = new Date();
  const subId = await makeSubscriptionFor(userId);
  const orderId = await seedZeroChargeOrder({
    externalOrderId: `sub-${subId}`,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });
  await linkDeliveryToOrder(subId, orderId);

  await promoteSettledZeroChargeOrders(now);
  assert.equal(await statusOf(orderId), "preparing", "a genuinely settled sponsored order stayed invisible to the kitchen");
});

test("P0 regression: a FORGED sub- prefix with NO real subscription_deliveries row is NOT promoted", async () => {
  // The exact defect: a client can set externalOrderId to any string it
  // likes, including one shaped like a genuine first-cycle order id, without
  // ever creating a subscription. Nothing but the string ever claimed to be
  // "sub-": no subscriptionsTable row, no subscriptionDeliveriesTable row —
  // proving the promoter no longer trusts the prefix on its own.
  const now = new Date();
  const orderId = await seedZeroChargeOrder({
    externalOrderId: `sub-${randomUUID()}`,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });

  await promoteSettledZeroChargeOrders(now);
  assert.equal(
    await statusOf(orderId),
    "placed",
    "a forged sub- prefix with no real subscription promoted an unpaid order — the trust boundary is broken",
  );
});

test("cross-customer reference attack: forging another customer's real subscription id does not promote", async () => {
  // Customer B has a REAL, genuinely-linked subscription (own order, own
  // delivery row). Customer A's own zero-charge order names B's subscription
  // id in its externalOrderId. The join is scoped to THIS order's own serial
  // id — never to any id parsed out of the string — so it cannot connect to
  // B's delivery row no matter what A writes there. No information about B's
  // subscription is leaked (A's order simply stays "placed", the same
  // outcome as any other unsettled zero).
  const now = new Date();
  const otherUserId = `u_rec_other_${randomUUID().slice(0, 8)}`;
  await db.insert(usersTable).values({
    id: otherUserId,
    phoneE164: "+910000000001",
    firstName: "Other",
    lastName: "Customer",
  });
  otherUserIds.push(otherUserId);

  const bSubId = await makeSubscriptionFor(otherUserId);
  const bOrderId = await seedZeroChargeOrder({
    externalOrderId: `sub-${bSubId}`,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
    ownerId: otherUserId,
  });
  await linkDeliveryToOrder(bSubId, bOrderId);

  // A's own order, owned by the suite's default user — NOT otherUserId.
  // orders.externalOrderId is unique only per (userId, externalOrderId), so
  // two different owners choosing the identical string is exactly the
  // scenario this test exists to prove is safe; a bare re-use under the SAME
  // owner would instead trip Postgres's own uniqueness constraint before the
  // promoter logic is ever reached.
  const aOrderId = await seedZeroChargeOrder({
    externalOrderId: `sub-${bSubId}`, // forged: names B's real subscription
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });

  await promoteSettledZeroChargeOrders(now);

  assert.equal(
    await statusOf(aOrderId),
    "placed",
    "customer A was promoted using customer B's real subscription reference",
  );
  // Control: B's own genuinely-linked order still promotes normally — proves
  // the refusal above is the ownership check, not a broken join.
  assert.equal(await statusOf(bOrderId), "preparing", "the genuine owner's order was not promoted");
});

test("a zero-charge order with a credit redemption on its claim is promoted", async () => {
  const now = new Date();
  const ext = `zc-claim-${RUN}`;
  const orderId = await seedZeroChargeOrder({
    externalOrderId: ext,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });
  const [claim] = await db
    .insert(orderClaimsTable)
    .values({ userId, orderId: ext, grossPaise: 25000, redeemedPaise: 25000, finalPaise: 0 })
    .returning({ id: orderClaimsTable.id });
  claimIds.push(claim!.id);

  await promoteSettledZeroChargeOrders(now);
  assert.equal(await statusOf(orderId), "preparing", "a credit-settled order stayed unpromoted");
});

test("cross-customer claim reference: reusing another customer's externalOrderId string does not inherit their claim", async () => {
  // orders.externalOrderId is unique only PER USER (routes/checkout.ts and
  // routes/loyalty.ts both scope their unique constraint to (userId,
  // externalOrderId)), so two different customers can legitimately pick the
  // identical string. Customer B genuinely redeemed credits on an order
  // named "shared-id"; customer A creates their OWN unsettled zero-charge
  // order under the SAME string. The claim lookup must be scoped by userId,
  // not just the string, or A inherits B's settlement.
  const now = new Date();
  const otherUserId = `u_rec_claimother_${randomUUID().slice(0, 8)}`;
  await db.insert(usersTable).values({
    id: otherUserId,
    phoneE164: "+910000000002",
    firstName: "Other",
    lastName: "Claimant",
  });
  otherUserIds.push(otherUserId);

  const sharedExt = `shared-id-${RUN}`;
  const bOrderId = await seedZeroChargeOrder({
    externalOrderId: sharedExt,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
    ownerId: otherUserId,
  });
  const [bClaim] = await db
    .insert(orderClaimsTable)
    .values({ userId: otherUserId, orderId: sharedExt, grossPaise: 25000, redeemedPaise: 25000, finalPaise: 0 })
    .returning({ id: orderClaimsTable.id });
  claimIds.push(bClaim!.id);

  const aOrderId = await seedZeroChargeOrder({
    externalOrderId: sharedExt, // same string, DIFFERENT owner (the suite's `userId`)
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });

  await promoteSettledZeroChargeOrders(now);

  assert.equal(
    await statusOf(aOrderId),
    "placed",
    "customer A inherited customer B's credit-claim settlement via a shared externalOrderId string",
  );
  assert.equal(await statusOf(bOrderId), "preparing", "the genuine claimant's own order was not promoted");
});

test("partial settlement never reaches the promoter: a non-zero remaining charge stays placed", async () => {
  // Owner's scenario: amount due ₹500, verified settlement ₹300 → no release.
  // The promoter's candidate query filters chargePaise = 0 — a partially
  // redeemed order (chargePaise still positive) is excluded before evidence
  // is ever evaluated, so it cannot be promoted through this path at all.
  const now = new Date();
  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "placed",
      totalPaise: 50000, // ₹500 due
      chargePaise: 20000, // ₹300 settled, ₹200 still owed — NOT zero
      externalOrderId: `zc-partial-${RUN}`,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
      items: [],
      orderKind: "meal",
    })
    .returning({ id: ordersTable.id });
  orderIds.push(order!.id);
  const [claim] = await db
    .insert(orderClaimsTable)
    .values({ userId, orderId: `zc-partial-${RUN}`, grossPaise: 50000, redeemedPaise: 30000, finalPaise: 20000 })
    .returning({ id: orderClaimsTable.id });
  claimIds.push(claim!.id);

  await promoteSettledZeroChargeOrders(now);
  assert.equal(await statusOf(order!.id), "placed", "a partially-settled order was released for fulfilment");
});

test("a discount-minted zero with NO settlement evidence is NOT promoted", async () => {
  // The free-food hole: operator pickup/bundle discounts can price an order
  // to ₹0 without anyone settling it. Bare chargePaise === 0 is not evidence.
  const now = new Date();
  const orderId = await seedZeroChargeOrder({
    externalOrderId: `zc-disc-${RUN}`,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });

  await promoteSettledZeroChargeOrders(now);
  assert.equal(await statusOf(orderId), "placed", "an unsettled ₹0 order was made cookable");
});

test("a settled zero-charge order inside the 2-minute grace window is left to the finalize", async () => {
  // The in-transaction finalize owns the fresh case; the sweep is the healer
  // for rows that predate the invariant or lost the post-tx race. Promoting
  // instantly would double-drive the same edge the finalize is mid-writing.
  const now = new Date();
  const orderId = await seedZeroChargeOrder({
    externalOrderId: `sub-${randomUUID()}`,
    createdAt: new Date(now.getTime() - 30 * 1000),
  });

  await promoteSettledZeroChargeOrders(now);
  assert.equal(await statusOf(orderId), "placed", "the sweep raced the finalize inside the grace window");
});

test("runOrderReconciliationSweep runs the zero-charge promoter before the gateway pass", async () => {
  // Wiring, not logic: a settled sponsored row has NO razorpayOrderId, so the
  // gateway half of the sweep can never touch it — if the entry point skipped
  // the promoter (e.g. behind the credentials check), the row would sit
  // "placed" forever with zero owed and zero collectable.
  const now = new Date();
  const subId = await makeSubscriptionFor(userId);
  const orderId = await seedZeroChargeOrder({
    externalOrderId: `sub-${subId}`,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000),
  });
  await linkDeliveryToOrder(subId, orderId);

  await runOrderReconciliationSweep({
    now,
    fetchFn: (async () => ({ ok: false, status: 404 })) as any,
  });
  assert.equal(await statusOf(orderId), "preparing", "the sweep entry point never ran the promoter");
});
