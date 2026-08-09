/**
 * Integration tests for the checkout safety contract on `finalizeOrder`:
 *
 *   1. The server re-prices every line from the shared catalog and ignores
 *      the client-supplied `price` (so a tampered cart can't get a discount
 *      by claiming `price: 1`, nor charge an inflated price by claiming
 *      `price: 9_999_999`).
 *   2. The pickup discount is sourced from `pickup_locations.discount_paise`
 *      — never the request — and is capped so the order total can never go
 *      negative even when the location's discount exceeds the subtotal.
 *   3. The optional `subscriptionId` linkage (settlement-trust-boundary audit,
 *      docs/MONEY-PATH-VERIFICATION.md §10): a client-supplied subscription id
 *      must belong to the caller, and a delivery already linked to an order
 *      can never be re-linked to a second one.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/loyaltyEngine.checkout.test.ts
 *
 * Hits the real dev DB via DATABASE_URL. Each test uses its own user +
 * external order id so concurrent runs don't collide.
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import {
  creditLedgerTable,
  db,
  orderClaimsTable,
  ordersTable,
  pickupLocationsTable,
  subscriptionDeliveriesTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { TEST_DISHES as DISHES } from "../test-fixtures/dishes.js";

import { finalizeOrder } from "./loyaltyEngine";

// Premium-only slugs are gated at the route layer (not finalizeOrder),
// but we still avoid them so the engine-level price assertions are not
// accidentally short-circuited by route-only behavior.
const PREMIUM_SLUGS = new Set([
  "alfredo-pasta-prawns",
  "pesto-pasta-prawns",
  "crispy-peri-peri-chicken-burrito-wrap",
]);

function pickAvailableDishes(n: number) {
  const pool = DISHES.filter(
    (d) => d.isAvailable && !PREMIUM_SLUGS.has(d.slug) && d.price > 0,
  );
  if (pool.length < n) {
    throw new Error(`catalog only has ${pool.length} usable dishes`);
  }
  return pool.slice(0, n);
}

const CREATED_USER_IDS: string[] = [];
const CREATED_PICKUP_IDS: number[] = [];
const CREATED_SUBSCRIPTION_IDS: number[] = [];

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `checkout-test-${id}@example.test`,
    firstName: "Checkout",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

// Neutralise the first-order offer for tests that assert legacy pricing:
// a user with any prior non-cancelled order is ineligible, so seeding one
// delivered order restores the pre-offer math those tests lock in.
async function seedPriorOrder(userId: string): Promise<void> {
  await db.insert(ordersTable).values({
    userId,
    externalOrderId: `prior-${randomUUID()}`,
    status: "delivered",
    totalPaise: 10_000,
    items: [{ id: 1, name: "Prior Meal", qty: 1, price: 10_000 }],
    fulfillmentType: "delivery",
  });
}

async function makePickupLocation(discountPaise: number): Promise<number> {
  const [loc] = await db
    .insert(pickupLocationsTable)
    .values({
      name: `Checkout Test Pickup ${randomUUID().slice(0, 6)}`,
      addressLine: "1 Test St",
      city: "Bengaluru",
      pincode: "560001",
      lat: 12.97,
      lng: 77.59,
      discountPaise,
      active: true,
    })
    .returning();
  CREATED_PICKUP_IDS.push(loc!.id);
  return loc!.id;
}

before(async () => {
  // No shared fixture — each test creates its own pickup location with a
  // discount tailored to the assertion (zero, or larger-than-subtotal).
});

async function makeSubscriptionWithDelivery(ownerId: string): Promise<{
  subscriptionId: number;
  deliveryId: number;
}> {
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
  CREATED_SUBSCRIPTION_IDS.push(sub!.id);
  const [delivery] = await db
    .insert(subscriptionDeliveriesTable)
    .values({
      subscriptionId: sub!.id,
      scheduledFor: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      deliveryWindow: "12:00-14:00",
      status: "upcoming",
      items: [],
    })
    .returning({ id: subscriptionDeliveriesTable.id });
  return { subscriptionId: sub!.id, deliveryId: delivery!.id };
}

after(async () => {
  if (CREATED_USER_IDS.length > 0) {
    await db
      .delete(orderClaimsTable)
      .where(inArray(orderClaimsTable.userId, CREATED_USER_IDS));
    await db
      .delete(ordersTable)
      .where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db
      .delete(creditLedgerTable)
      .where(inArray(creditLedgerTable.userId, CREATED_USER_IDS));
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, CREATED_USER_IDS));
  }
  for (const id of CREATED_PICKUP_IDS) {
    await db.delete(pickupLocationsTable).where(eq(pickupLocationsTable.id, id));
  }
  if (CREATED_SUBSCRIPTION_IDS.length > 0) {
    // subscriptionDeliveriesTable cascades with its subscription.
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.id, CREATED_SUBSCRIPTION_IDS));
  }
});

test("finalizeOrder ignores client-supplied price and re-prices from the catalog", async () => {
  const userId = await makeUser();
  await seedPriorOrder(userId);
  const pickupLocationId = await makePickupLocation(0);
  const [a, b] = pickAvailableDishes(2);
  const expectedGross = a!.price * 2 + b!.price * 1;

  // Client lies: sends absurd prices, both very high (to inflate the
  // total) and zero (to get a freebie). finalizeOrder must throw both
  // away and re-price every line from the merged catalog.
  const out = await finalizeOrder({
    userId,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    items: [
      { id: a!.id, name: "FAKE NAME", qty: 2, price: 9_999_999 },
      { id: b!.id, name: "FAKE NAME", qty: 1, price: 0 },
    ],
  });

  assert.equal(
    out.grossPaise,
    expectedGross,
    "gross must equal sum of catalog prices, not the client-supplied prices",
  );
  assert.equal(out.bundleDiscountPaise, 0);
  assert.equal(out.pickupDiscountPaise, 0);
  assert.equal(out.preorderDiscountPaise, 0);
  assert.equal(out.finalPaise, expectedGross);

  // The persisted order row must also carry catalog values, not the
  // tampered name/price the client sent.
  const [persisted] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, out.serverOrderId));
  assert.ok(persisted, "order row must exist");
  const persistedItems = (persisted!.items ?? []) as Array<{
    id: number;
    name: string;
    qty: number;
    price: number;
  }>;
  assert.equal(persistedItems.length, 2);
  const persistedA = persistedItems.find((i) => i.id === a!.id)!;
  const persistedB = persistedItems.find((i) => i.id === b!.id)!;
  assert.equal(persistedA.name, a!.name, "name must come from catalog");
  assert.equal(persistedA.price, a!.price, "price must come from catalog");
  assert.equal(persistedA.qty, 2);
  assert.equal(persistedB.name, b!.name);
  assert.equal(persistedB.price, b!.price);
  assert.equal(persistedB.qty, 1);
  assert.equal(persisted!.totalPaise, expectedGross);
});

test("finalizeOrder uses pickup_locations.discount_paise and caps it so total never goes negative", async () => {
  const userId = await makeUser();
  await seedPriorOrder(userId);
  const [a] = pickAvailableDishes(1);
  // Pickup location offers a discount that is FAR larger than the
  // subtotal. The cap inside finalizeOrder must clamp pickupDiscountPaise
  // to the gross so finalPaise can never be negative.
  const oversizedDiscount = a!.price * 10 + 1_000_000;
  const pickupLocationId = await makePickupLocation(oversizedDiscount);

  const out = await finalizeOrder({
    userId,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    // Even if the client also sends a tampered `price`, the discount
    // source is still the DB row, so we keep the price honest here to
    // isolate this assertion to the cap behavior.
    items: [{ id: a!.id, name: a!.name, qty: 1, price: a!.price }],
  });

  // `grossPaise` in the response is the post-discount gross (after
  // bundle + pickup + preorder discounts), so the catalog subtotal is
  // recoverable as gross + pickup discount when no other discount
  // applies.
  const recoveredSubtotal = out.grossPaise + out.pickupDiscountPaise;
  assert.equal(recoveredSubtotal, a!.price, "subtotal must come from catalog");
  assert.equal(
    out.pickupDiscountPaise,
    a!.price,
    "pickup discount must be clamped to subtotal, not the (much larger) DB value",
  );
  assert.equal(
    out.finalPaise,
    0,
    "final must clamp at zero — order total can never go negative",
  );
  assert.ok(out.finalPaise >= 0, "final must never be negative");

  // The persisted total mirrors the clamped final.
  const [persisted] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, out.serverOrderId));
  assert.ok(persisted);
  assert.equal(persisted!.totalPaise, 0);
});

test("finalizeOrder takes the pickup discount from the DB row, ignoring any request-side hint", async () => {
  // The route schema does not even accept a discount field, but we lock
  // in here that finalizeOrder reads the discount from the DB row of the
  // chosen pickup location rather than any caller-controlled value.
  const userId = await makeUser();
  await seedPriorOrder(userId);
  const [a, b] = pickAvailableDishes(2);
  const subtotal = a!.price + b!.price;
  const dbDiscount = Math.floor(subtotal / 4); // 25% off, well within bounds
  const pickupLocationId = await makePickupLocation(dbDiscount);

  const out = await finalizeOrder({
    userId,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    items: [
      { id: a!.id, name: a!.name, qty: 1, price: a!.price },
      { id: b!.id, name: b!.name, qty: 1, price: b!.price },
    ],
  });

  assert.equal(
    out.pickupDiscountPaise,
    dbDiscount,
    "pickup discount must come from pickup_locations.discount_paise",
  );
  // `grossPaise` is the post-discount gross; recover catalog subtotal.
  assert.equal(
    out.grossPaise + out.pickupDiscountPaise,
    subtotal,
    "subtotal recovered from response must equal catalog subtotal",
  );
  assert.equal(out.finalPaise, subtotal - dbDiscount);
});

test("first-order offer: 25% off capped at Rs.80, first order only, retry-safe", async (t) => {
  const [a] = pickAvailableDishes(1);
  // Zero-discount pickup avoids delivery-slot fixtures while keeping the
  // pricing pipeline identical (pickup discount of 0 is a no-op).
  const zeroPickupId = await makePickupLocation(0);

  await t.test("applies 25% (or the Rs.80 cap) to a user's first order", async () => {
    const userId = await makeUser();
    const orderId = `ord-${randomUUID()}`;
    const out = await finalizeOrder({
      userId,
      orderId,
      fulfillmentType: "pickup",
      pickupLocationId: zeroPickupId,
      items: [{ id: a!.id, name: a!.name, qty: 1, price: a!.price }],
    });
    const expected = Math.min(Math.floor((a!.price * 2500) / 10_000), 8_000);
    assert.equal(
      out.firstOrderDiscountPaise,
      expected,
      "first order must get 25% off, capped at 8000 paise",
    );
    assert.equal(out.finalPaise, a!.price - expected);

    // Idempotent retry of the SAME first order must report the same
    // discount, not zero (the order's own row must not disqualify it).
    const retry = await finalizeOrder({
      userId,
      orderId,
      fulfillmentType: "pickup",
      pickupLocationId: zeroPickupId,
      items: [{ id: a!.id, name: a!.name, qty: 1, price: a!.price }],
    });
    assert.equal(retry.duplicate, true);
    assert.equal(
      retry.firstOrderDiscountPaise,
      expected,
      "duplicate replay must carry the same first-order discount",
    );
  });

  await t.test("does not apply to a second order", async () => {
    const userId = await makeUser();
    await finalizeOrder({
      userId,
      orderId: `ord-${randomUUID()}`,
      fulfillmentType: "pickup",
      pickupLocationId: zeroPickupId,
      items: [{ id: a!.id, name: a!.name, qty: 1, price: a!.price }],
    });
    const second = await finalizeOrder({
      userId,
      orderId: `ord-${randomUUID()}`,
      fulfillmentType: "pickup",
      pickupLocationId: zeroPickupId,
      items: [{ id: a!.id, name: a!.name, qty: 1, price: a!.price }],
    });
    assert.equal(second.firstOrderDiscountPaise, 0, "second order gets no first-order discount");
    assert.equal(second.finalPaise, a!.price);
  });

  await t.test("hard cap at Rs.80 for large first orders", async () => {
    const userId = await makeUser();
    // qty chosen so 25% of the subtotal comfortably exceeds the cap.
    const qty = Math.max(1, Math.ceil(33_000 / a!.price));
    const subtotal = a!.price * qty;
    const out = await finalizeOrder({
      userId,
      orderId: `ord-${randomUUID()}`,
      fulfillmentType: "pickup",
      pickupLocationId: zeroPickupId,
      items: [{ id: a!.id, name: a!.name, qty, price: a!.price }],
    });
    assert.equal(out.firstOrderDiscountPaise, 8_000, "discount must clamp at 8000 paise");
    assert.equal(out.finalPaise, subtotal - 8_000);
  });
});

// ---------------------------------------------------------------------------
// subscriptionId linkage (settlement-trust-boundary audit,
// docs/MONEY-PATH-VERIFICATION.md §10). finalizeOrder's `subscriptionId` is a
// bare client-supplied number (routes/loyalty.ts's finalizeOrderSchema) that
// links a subscription's earliest upcoming delivery to the new order —
// exactly the linkage the reconciliation sweep's zero-charge promoter later
// trusts as settlement evidence. Naming a subscription the caller does not
// own, or one whose delivery is already spoken for, must both be refused.
// ---------------------------------------------------------------------------

test("finalizeOrder refuses to link a delivery from a subscription the caller does not own", async () => {
  const owner = await makeUser();
  const attacker = await makeUser();
  const { subscriptionId, deliveryId } = await makeSubscriptionWithDelivery(owner);
  const pickupLocationId = await makePickupLocation(0);
  const [dish] = pickAvailableDishes(1);

  await finalizeOrder({
    userId: attacker,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    subscriptionId, // forged: names a subscription belonging to `owner`
    items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
  });

  const [delivery] = await db
    .select({ orderId: subscriptionDeliveriesTable.orderId })
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(
    delivery?.orderId,
    null,
    "an attacker's order was linked to a stranger's real subscription delivery",
  );
});

test("finalizeOrder never re-links a delivery that already belongs to another order", async () => {
  const owner = await makeUser();
  const { subscriptionId, deliveryId } = await makeSubscriptionWithDelivery(owner);
  const pickupLocationId = await makePickupLocation(0);
  const [dish] = pickAvailableDishes(1);

  const first = await finalizeOrder({
    userId: owner,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    subscriptionId,
    items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
  });
  const [afterFirst] = await db
    .select({ orderId: subscriptionDeliveriesTable.orderId })
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(afterFirst?.orderId, first.serverOrderId, "the first, legitimate link must succeed");

  // Same real owner, same real subscription, a SECOND unrelated order. Without
  // the isNull(orderId) guard this delivery — and the settlement evidence it
  // carries — could be minted again for every subsequent order.
  await finalizeOrder({
    userId: owner,
    orderId: `ord-${randomUUID()}`,
    fulfillmentType: "pickup",
    pickupLocationId,
    subscriptionId,
    items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
  });

  const [afterSecond] = await db
    .select({ orderId: subscriptionDeliveriesTable.orderId })
    .from(subscriptionDeliveriesTable)
    .where(eq(subscriptionDeliveriesTable.id, deliveryId));
  assert.equal(
    afterSecond?.orderId,
    first.serverOrderId,
    "an already-linked delivery was stolen by a second order",
  );
});

test("finalizeOrder refuses to adopt and reprice a pre-existing order it did not create", async () => {
  // The order INSERT is idempotent on (userId, externalOrderId); on conflict
  // the old code fell through to an unconditional charge_paise UPDATE with no
  // check on the pre-existing row's provenance. createOrderForNewSubscription
  // (routes/subscriptions.ts) and chargeMandate.ts mint real orders under
  // exactly this externalOrderId shape — nothing stopped a caller from naming
  // one of their own subscription-cycle order ids here and having it silently
  // repriced to whatever THIS cart's contents total, potentially down to a
  // credit/subsidy-covered zero (the exact settlement-trust-boundary shape
  // docs/MONEY-PATH-VERIFICATION.md §10 is about).
  const owner = await makeUser();
  const externalOrderId = `sub-preexisting-${randomUUID()}`;
  const originalChargePaise = 123456;
  const [preexisting] = await db
    .insert(ordersTable)
    .values({
      userId: owner,
      externalOrderId,
      status: "placed",
      totalPaise: originalChargePaise,
      chargePaise: originalChargePaise,
      items: [{ id: 1, name: "Subscription Meal", qty: 1, price: originalChargePaise }],
      fulfillmentType: "delivery",
    })
    .returning({ id: ordersTable.id });

  const pickupLocationId = await makePickupLocation(0);
  const [dish] = pickAvailableDishes(1);
  await assert.rejects(
    finalizeOrder({
      userId: owner,
      orderId: externalOrderId, // same owner, same externalOrderId — no matching claim exists
      fulfillmentType: "pickup",
      pickupLocationId,
      items: [{ id: dish!.id, name: dish!.name, qty: 1, price: dish!.price }],
    }),
    (err: unknown) => {
      // A RegExp matcher here would test String(err) ("Error: <message>"),
      // not err.message — an anchored /^.../ against that always misses the
      // "Error: " prefix. Match the message field directly instead.
      const e = err as Error;
      assert.match(e.message, /^order_id_conflict:/);
      return true;
    },
  );

  const [after] = await db
    .select({ chargePaise: ordersTable.chargePaise })
    .from(ordersTable)
    .where(eq(ordersTable.id, preexisting!.id));
  assert.equal(
    after?.chargePaise,
    originalChargePaise,
    "a foreign order's real charge_paise was overwritten by an adopted checkout",
  );
});
