/**
 * The corporate-subsidy ledger against real Postgres.
 *
 * What this pins is one identity, across every path money can take:
 *
 *     what the customer's card is charged  +  what the company is billed
 *       ===  what the order is worth
 *
 * Before this, the two halves were computed in different places and neither
 * knew about the other: the browser subtracted the subsidy from what it
 * DISPLAYED, `/payments/razorpay/order` billed the un-reduced `charge_paise`,
 * and a post-payment call billed the company as well. The customer paid gross,
 * the company paid the subsidy, and the sum came to gross + subsidy.
 *
 * Needs Postgres for the parts that are genuinely about the database: the
 * unique index that makes commit idempotent, the advisory lock that makes two
 * concurrent reservations serialise, and the conditional status update that
 * makes a second commit a no-op. The pure clamping rules are unit-tested
 * separately in lib/corporateSubsidy.test.ts.
 *
 * Run from artifacts/api-server:
 *   node --test --test-force-exit --import tsx ./src/routes/corporate.subsidyLedger.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  companiesTable,
  companyBudgetUsageTable,
  companyMembersTable,
  companySubsidyChargesTable,
  orderClaimsTable,
  ordersTable,
  pickupLocationsTable,
  usersTable,
} from "@workspace/db";
import { TEST_DISHES } from "../test-fixtures/dishes.js";
import { computeChargePaise, finalizeOrder } from "../lib/loyaltyEngine";

import {
  budgetPeriodMonth,
  commitSubsidyForOrder,
  quoteSubsidyPaise,
  releaseSubsidyForOrder,
  reserveSubsidyForOrder,
} from "../lib/corporateSubsidy";

const RUN = randomUUID().slice(0, 8);
const CREATED_USER_IDS: string[] = [];
const CREATED_ORDER_IDS: number[] = [];

const BUDGET = 500_000; // ₹5,000/month
const GROSS = 100_000; // a ₹1,000 order

after(async () => {
  if (CREATED_ORDER_IDS.length > 0) {
    await db
      .delete(companySubsidyChargesTable)
      .where(inArray(companySubsidyChargesTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    // companies.owner_user_id, company_members.user_id and
    // company_budget_usage.user_id all cascade from users.
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

/** A user who is an active member of a company with `budget` unspent. */
async function seedMember(
  budget = BUDGET,
  overridePaise: number | null = null,
): Promise<{ userId: string; companyId: number }> {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `subsidy-${userId}@example.test`,
    firstName: "Corporate",
    lastName: "Member",
  });
  CREATED_USER_IDS.push(userId);
  const [company] = await db
    .insert(companiesTable)
    .values({
      slug: `subsidy-co-${RUN}-${CREATED_USER_IDS.length}`,
      name: "Subsidy Co",
      ownerUserId: userId,
      perEmployeeMonthlyBudgetPaise: budget,
    })
    .returning({ id: companiesTable.id });
  await db.insert(companyMembersTable).values({
    companyId: company!.id,
    userId,
    email: `subsidy-${userId}@example.test`,
    role: "member",
    status: "active",
    perEmployeeBudgetPaiseOverride: overridePaise,
  });
  return { userId, companyId: company!.id };
}

async function seedOrder(userId: string): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      externalOrderId: `TAN-subsidy-${randomUUID().slice(0, 12)}`,
      status: "placed",
      userId,
      totalPaise: GROSS,
      chargePaise: GROSS,
      items: [],
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function spentPaise(companyId: number, userId: string): Promise<number> {
  const [usage] = await db
    .select({ spentPaise: companyBudgetUsageTable.spentPaise })
    .from(companyBudgetUsageTable)
    .where(
      and(
        eq(companyBudgetUsageTable.companyId, companyId),
        eq(companyBudgetUsageTable.userId, userId),
        eq(companyBudgetUsageTable.periodMonth, budgetPeriodMonth()),
      ),
    );
  return usage?.spentPaise ?? 0;
}

async function chargeStatus(orderId: number): Promise<string | null> {
  const [row] = await db
    .select({ status: companySubsidyChargesTable.status })
    .from(companySubsidyChargesTable)
    .where(eq(companySubsidyChargesTable.orderId, orderId));
  return row?.status ?? null;
}

// ---------------------------------------------------------------------------

test("reserve then commit: the company is billed exactly what the customer was not", async () => {
  const { userId, companyId } = await seedMember();
  const orderId = await seedOrder(userId);

  const reservation = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );
  assert.ok(reservation, "an active member with budget must get a reservation");
  const customerPaise = GROSS - reservation.paise;

  // Reserving does NOT touch spend — an abandoned checkout must not appear in
  // what the company is told it spent (b2b/qbrDrafter reads this column).
  assert.equal(await spentPaise(companyId, userId), 0);
  assert.equal(await chargeStatus(orderId), "reserved");

  await commitSubsidyForOrder(orderId);

  assert.equal(await chargeStatus(orderId), "committed");
  const billedToCompany = await spentPaise(companyId, userId);
  assert.equal(billedToCompany, reservation.paise);
  assert.equal(
    customerPaise + billedToCompany,
    GROSS,
    "customer charge + company charge must equal the order — this identity is the whole fix",
  );
});

test("committing twice bills the company once", async () => {
  // The verify path and the webhook can both land on the same capture. Before
  // the reservation row existed there was nothing to make the second one a
  // no-op.
  const { userId, companyId } = await seedMember();
  const orderId = await seedOrder(userId);
  await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );

  const first = await commitSubsidyForOrder(orderId);
  const second = await commitSubsidyForOrder(orderId);
  const third = await commitSubsidyForOrder(orderId);

  assert.equal(first.committedPaise, GROSS);
  assert.equal(second.committedPaise, 0, "a second commit must add nothing");
  assert.equal(third.committedPaise, 0);
  assert.equal(await spentPaise(companyId, userId), GROSS);
});

test("simultaneous commits of one order still bill once", async () => {
  // Honest scope: this fires three commits without awaiting between them, but
  // the driver's pool may still run the transactions back to back, so it does
  // not GUARANTEE an interleaving. It is the status guard plus the conditional
  // update that make the invariant hold either way — removing both turns this
  // and the sequential case red, which is what pins them.
  const { userId, companyId } = await seedMember();
  const orderId = await seedOrder(userId);
  await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );

  // Verify and webhook arriving together, not one after the other.
  const results = await Promise.all([
    commitSubsidyForOrder(orderId),
    commitSubsidyForOrder(orderId),
    commitSubsidyForOrder(orderId),
  ]);
  const total = results.reduce((n, r) => n + r.committedPaise, 0);
  assert.equal(total, GROSS, "exactly one caller may claim the commit");
  assert.equal(await spentPaise(companyId, userId), GROSS);
});

test("cancelling an unpaid order gives the budget back", async () => {
  const { userId, companyId } = await seedMember();
  const orderId = await seedOrder(userId);
  await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );

  const released = await releaseSubsidyForOrder(orderId);
  assert.equal(released.releasedPaise, GROSS);
  assert.equal(await chargeStatus(orderId), "released");
  assert.equal(await spentPaise(companyId, userId), 0);

  // And the freed money is quotable again.
  const quote = await quoteSubsidyPaise(userId, GROSS);
  assert.equal(quote.reservedPaise, 0);
  assert.equal(quote.remainingPaise, BUDGET);
});

test("releasing after capture does NOT claw back real money", async () => {
  // A cancel that arrives after the payment was captured must not silently
  // decrement the company's spend — unwinding a collected charge is the refund
  // path's job, with its own authority and audit trail.
  const { userId, companyId } = await seedMember();
  const orderId = await seedOrder(userId);
  await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );
  await commitSubsidyForOrder(orderId);

  const released = await releaseSubsidyForOrder(orderId);
  assert.equal(released.releasedPaise, 0, "a committed charge is not releasable");
  assert.equal(await chargeStatus(orderId), "committed");
  assert.equal(await spentPaise(companyId, userId), GROSS);
});

test("committing an order that was never reserved bills nothing", async () => {
  const { userId, companyId } = await seedMember();
  const orderId = await seedOrder(userId);
  const out = await commitSubsidyForOrder(orderId);
  assert.equal(out.committedPaise, 0);
  assert.equal(await spentPaise(companyId, userId), 0);
});

test("a second order can only reserve what the first one left", async () => {
  // ₹5,000 budget, two ₹40 orders... no: two orders of ₹3,000 each. The first
  // takes ₹3,000, the second may only take the remaining ₹2,000 even though it
  // is worth more.
  const { userId } = await seedMember();
  const BIG = 300_000;
  const firstOrder = await seedOrder(userId);
  const secondOrder = await seedOrder(userId);

  const a = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: firstOrder,
      grossPaise: BIG,
      optIn: true,
    }),
  );
  const b = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: secondOrder,
      grossPaise: BIG,
      optIn: true,
    }),
  );

  assert.equal(a?.paise, BIG);
  assert.equal(b?.paise, BUDGET - BIG, "the second order sees the first's hold");
  assert.equal(
    (a?.paise ?? 0) + (b?.paise ?? 0),
    BUDGET,
    "two orders may never reserve more than the monthly budget between them",
  );
});

test("concurrent reservations cannot both take the same money", async () => {
  // The advisory lock's reason for existing: without it both transactions read
  // the same remaining balance and both reserve against it.
  const { userId } = await seedMember();
  const BIG = 300_000;
  const o1 = await seedOrder(userId);
  const o2 = await seedOrder(userId);

  const [a, b] = await Promise.all([
    db.transaction((tx) =>
      reserveSubsidyForOrder(tx, {
        userId,
        serverOrderId: o1,
        grossPaise: BIG,
        optIn: true,
      }),
    ),
    db.transaction((tx) =>
      reserveSubsidyForOrder(tx, {
        userId,
        serverOrderId: o2,
        grossPaise: BIG,
        optIn: true,
      }),
    ),
  ]);

  const total = (a?.paise ?? 0) + (b?.paise ?? 0);
  assert.ok(
    total <= BUDGET,
    `two concurrent reservations took ${total} paise of a ${BUDGET} paise budget`,
  );
});

test("opting out reserves nothing and leaves the budget untouched", async () => {
  const { userId } = await seedMember();
  const orderId = await seedOrder(userId);
  const reservation = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: false,
    }),
  );
  assert.equal(reservation, null);
  assert.equal(await chargeStatus(orderId), null);
  const quote = await quoteSubsidyPaise(userId, GROSS);
  assert.equal(quote.remainingPaise, BUDGET);
});

test("a non-member gets no subsidy and pays the full amount", async () => {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `no-company-${userId}@example.test`,
    firstName: "Retail",
    lastName: "Customer",
  });
  CREATED_USER_IDS.push(userId);
  const orderId = await seedOrder(userId);

  const reservation = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );
  assert.equal(reservation, null);
  const quote = await quoteSubsidyPaise(userId, GROSS);
  assert.equal(quote.active, false);
  assert.equal(quote.subsidyPaise, 0);
});

test("a per-member override beats the company default", async () => {
  const { userId } = await seedMember(BUDGET, 20_000); // ₹200 for this employee
  const orderId = await seedOrder(userId);
  const reservation = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );
  assert.equal(reservation?.paise, 20_000);
});

test("re-reserving one order returns the ORIGINAL amount, not a fresh one", async () => {
  // finalizeOrder is idempotent and may replay. charge_paise was derived from
  // the first reservation, so a replay reporting a different number would
  // leave the client showing a total the gateway will not bill.
  const { userId } = await seedMember();
  const orderId = await seedOrder(userId);

  const first = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );
  // A replay at a different order value must not change the held amount.
  const replay = await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS * 2,
      optIn: true,
    }),
  );

  assert.equal(replay?.paise, first?.paise);
  const rows = await db
    .select({ id: companySubsidyChargesTable.id })
    .from(companySubsidyChargesTable)
    .where(eq(companySubsidyChargesTable.orderId, orderId));
  assert.equal(rows.length, 1, "a replay must not stack a second reservation");
});

test("the quote nets out reservations, so two open checkouts are not both promised the same money", async () => {
  const { userId } = await seedMember();
  const orderId = await seedOrder(userId);
  await db.transaction((tx) =>
    reserveSubsidyForOrder(tx, {
      userId,
      serverOrderId: orderId,
      grossPaise: GROSS,
      optIn: true,
    }),
  );

  const quote = await quoteSubsidyPaise(userId, GROSS);
  assert.equal(quote.committedPaise, 0, "nothing is spent until capture");
  assert.equal(quote.reservedPaise, GROSS);
  assert.equal(quote.remainingPaise, BUDGET - GROSS);
});

// ---------------------------------------------------------------------------
// The seam that makes all of the above real: finalizeOrder must write
// charge_paise ALREADY NET, because charge_paise is the only number the
// payment path bills. Everything else here is ledger bookkeeping; this is the
// assertion that the customer's card is actually debited the reduced amount.
// ---------------------------------------------------------------------------

const CREATED_PICKUP_IDS: number[] = [];

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(orderClaimsTable)
      .where(inArray(orderClaimsTable.userId, CREATED_USER_IDS));
  }
  for (const id of CREATED_PICKUP_IDS) {
    await db.delete(pickupLocationsTable).where(eq(pickupLocationsTable.id, id));
  }
});

/** Pickup avoids the delivery-slot requirement; zero discount keeps the maths bare. */
async function makePickupLocation(): Promise<number> {
  const [loc] = await db
    .insert(pickupLocationsTable)
    .values({
      name: `Subsidy Test Pickup ${randomUUID().slice(0, 6)}`,
      addressLine: "1 Test St",
      city: "Bengaluru",
      pincode: "560001",
      lat: 12.97,
      lng: 77.59,
      discountPaise: 0,
      active: true,
    })
    .returning();
  CREATED_PICKUP_IDS.push(loc!.id);
  return loc!.id;
}

/** A delivered prior order, so the first-order discount does not muddy the sum. */
async function seedPriorOrder(userId: string): Promise<void> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId: `prior-${randomUUID()}`,
      status: "delivered",
      totalPaise: 10_000,
      items: [{ id: 1, name: "Prior Meal", qty: 1, price: 10_000 }],
      fulfillmentType: "delivery",
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
}

test("finalizeOrder writes charge_paise NET of the subsidy, and reserves the difference", async () => {
  const dish = TEST_DISHES.find((d) => d.isAvailable && d.price > 0);
  assert.ok(dish, "the test catalog must have a priced, available dish");

  // Budget deliberately smaller than the order so the split is a real split
  // rather than "the company pays everything".
  const SMALL_BUDGET = 5_000; // ₹50
  const { userId, companyId } = await seedMember(SMALL_BUDGET);
  await seedPriorOrder(userId);
  const pickupLocationId = await makePickupLocation();

  const out = await finalizeOrder({
    userId,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    items: [{ id: dish.id, name: "IGNORED", qty: 1, price: 0 }],
  });
  CREATED_ORDER_IDS.push(out.serverOrderId);

  // What the order would have cost with no subsidy, from the same helper the
  // engine uses — so this asserts the subtraction, not a re-derivation of GST.
  const gross = computeChargePaise({
    finalPaise: out.finalPaise,
    subtotalPaise: out.grossPaise,
    fulfillmentType: "pickup",
  }).chargePaise;

  assert.equal(out.subsidyPaise, SMALL_BUDGET, "the whole allowance is applied");
  assert.equal(
    out.chargePaise,
    gross - SMALL_BUDGET,
    "the returned charge must be net of the company's share",
  );

  // And the PERSISTED value, which is what /payments/razorpay/order bills.
  const [persisted] = await db
    .select({ chargePaise: ordersTable.chargePaise })
    .from(ordersTable)
    .where(eq(ordersTable.id, out.serverOrderId));
  assert.equal(
    persisted!.chargePaise,
    gross - SMALL_BUDGET,
    "charge_paise in the database is the only number the gateway sees",
  );

  // Reserved, not yet spent — the payment has not been captured.
  assert.equal(await chargeStatus(out.serverOrderId), "reserved");
  assert.equal(await spentPaise(companyId, userId), 0);

  // Capture, and the two halves add back up to the gross.
  await commitSubsidyForOrder(out.serverOrderId);
  const billedToCompany = await spentPaise(companyId, userId);
  assert.equal(billedToCompany, SMALL_BUDGET);
  assert.equal(persisted!.chargePaise! + billedToCompany, gross);
});

test("finalizeOrder charges the full amount when the member opts out", async () => {
  const dish = TEST_DISHES.find((d) => d.isAvailable && d.price > 0);
  const { userId } = await seedMember();
  await seedPriorOrder(userId);
  const pickupLocationId = await makePickupLocation();

  const out = await finalizeOrder({
    userId,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    items: [{ id: dish!.id, name: "IGNORED", qty: 1, price: 0 }],
    applySubsidy: false,
  });
  CREATED_ORDER_IDS.push(out.serverOrderId);

  const gross = computeChargePaise({
    finalPaise: out.finalPaise,
    subtotalPaise: out.grossPaise,
    fulfillmentType: "pickup",
  }).chargePaise;
  assert.equal(out.subsidyPaise, 0);
  assert.equal(out.chargePaise, gross);
  assert.equal(await chargeStatus(out.serverOrderId), null);
});
