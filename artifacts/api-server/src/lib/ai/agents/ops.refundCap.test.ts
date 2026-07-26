/**
 * Integration tests locking the refund authority of the ops agent's
 * `refund_order` tool — how much money this tool may send back against one
 * order, and how it knows.
 *
 * The tool takes its `amountPaise` from an LLM acting on an operator's chat
 * message. That makes the server-side cap the only thing standing between a
 * misread sentence and a real payout, so the cap is what these tests pin. Two
 * defects are pinned as fixed:
 *
 *   1. The cap read `orders.total_paise` — the meal subtotal, which the schema
 *      says in as many words is NOT the charged amount (no GST, no delivery
 *      fee). Every order the loyalty finalize path writes has a `charge_paise`
 *      that is strictly larger. Capping at total_paise refused to return money
 *      the customer had demonstrably paid.
 *
 *   2. The cap compared against the order total on every call and never
 *      against what had already gone back, so the same full-value refund
 *      passed it once, twice, five times. Worse, it could not see refunds the
 *      refunds console had issued at all, because that path records
 *      `order_refunded` while this tool only ever wrote and read
 *      `refund_issued`.
 *
 * The arithmetic itself is unit-tested DB-free in lib/paymentIntegrity.test.ts.
 * What can only be tested here, against real rows, is that the tool consults
 * it — and that it reads BOTH event dialects when it does.
 *
 * These call the tool's handler directly rather than driving the LLM: the
 * handler is the trust boundary, and a test that had to coax a model into
 * emitting a tool call would be pinning the model, not the guard.
 *
 * Needs DATABASE_URL (CI: money-integration job's Postgres service).
 *
 * Run with:
 *   node --test --import tsx ./src/lib/ai/agents/ops.refundCap.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  deliveryEventsTable,
  opsActionsTable,
  ordersTable,
  usersTable,
} from "@workspace/db";

import { getAgent } from "../agentRegistry";
import type { ToolContext } from "../tools";
import "./ops";

const RUN = randomUUID().slice(0, 8);

// ---------------------------------------------------------------------------
// The tool under test, resolved through the registry by name rather than by
// position in the agent's `tools` array. Position is not a contract; a tool
// inserted above it would silently re-point this whole file at assign_rider.
// ---------------------------------------------------------------------------

const opsAgent = getAgent("ops");
assert.ok(opsAgent, "ops agent is not registered");
const refundTool = opsAgent.tools.find((t) => t.name === "refund_order");
assert.ok(refundTool, "ops agent has no refund_order tool");
// Bound out here so the narrowing above survives into the closure below.
const refundHandler = refundTool.handler;

interface RefundInput {
  orderId: number;
  amountPaise: number;
  reason: string;
  reasoning: string;
  confirm?: boolean;
}

interface RefundOutput {
  success?: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  summary?: string;
  amountPaise?: number;
  status?: string;
}

const CTX: ToolContext = {
  userId: `ops-operator-${RUN}`,
  agent: "ops",
  isOps: true,
  isCatalog: false,
};

async function refund(input: RefundInput): Promise<RefundOutput> {
  return (await refundHandler(input, CTX)) as RefundOutput;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATED_ORDER_IDS: number[] = [];
const CREATED_USER_IDS: string[] = [];

after(async () => {
  if (CREATED_ORDER_IDS.length > 0) {
    await db
      .delete(deliveryEventsTable)
      .where(inArray(deliveryEventsTable.orderId, CREATED_ORDER_IDS));
    await db.delete(ordersTable).where(inArray(ordersTable.id, CREATED_ORDER_IDS));
  }
  await db.delete(opsActionsTable).where(eq(opsActionsTable.operatorId, CTX.userId!));
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

async function makeUser(label: string): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `refund-cap-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  return id;
}

const userId = await makeUser("operator-subject");

/**
 * An order charged `chargePaise` whose meal subtotal is `totalPaise`. The gap
 * between the two — GST plus the delivery fee — is exactly the money the old
 * cap would not give back, so every fixture here keeps them distinct. A
 * fixture with total === charge would pass both the broken and the fixed cap.
 */
async function seedOrder(opts: {
  totalPaise: number;
  chargePaise: number | null;
  status?: string;
}): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId: `TAN-RFCAP-${randomUUID().slice(0, 8)}-${RUN}`,
      status: opts.status ?? "delivered",
      totalPaise: opts.totalPaise,
      chargePaise: opts.chargePaise,
      orderKind: "meal",
      orderChannel: "own_app",
      items: [{ id: 31, name: "Moong Khichdi", qty: 2, price: 21000 }],
      fulfillmentType: "delivery",
      pincode: "560001",
      addressLine: "12 Test Lane",
      city: "Bengaluru",
      phone: "+919000000001",
      priority: "routine",
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function seedRefundEvent(
  orderId: number,
  event: "refund_issued" | "order_refunded",
  meta: Record<string, unknown>,
): Promise<void> {
  await db.insert(deliveryEventsTable).values({ orderId, event, meta });
}

async function refundEventsFor(orderId: number): Promise<{ event: string; meta: unknown }[]> {
  return db
    .select({ event: deliveryEventsTable.event, meta: deliveryEventsTable.meta })
    .from(deliveryEventsTable)
    .where(
      and(
        eq(deliveryEventsTable.orderId, orderId),
        inArray(deliveryEventsTable.event, ["refund_issued", "order_refunded"]),
      ),
    );
}

async function statusOf(orderId: number): Promise<string | undefined> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  return row?.status;
}

// Subtotal ₹400, charged ₹512 (18% GST + ₹40 delivery, near enough). The ₹112
// gap is the money the old cap refused to return.
const SUBTOTAL = 40000;
const CHARGED = 51200;

// ---------------------------------------------------------------------------
// Defect 1 — the cap is charge_paise, not total_paise
// ---------------------------------------------------------------------------

test("refunds the full charged amount, not just the meal subtotal", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });

  const out = await refund({
    orderId,
    amountPaise: CHARGED,
    reason: "order never arrived",
    reasoning: "customer reported non-delivery, rider confirmed",
    confirm: true,
  });

  // Before the fix this was refused with "exceeds order total 40000" — the
  // customer's GST and delivery fee were unrefundable through this tool.
  assert.equal(out.success, true, `expected success, got: ${JSON.stringify(out)}`);
  assert.equal(out.amountPaise, CHARGED);
  assert.equal(await statusOf(orderId), "refunded");

  const events = await refundEventsFor(orderId);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.event, "refund_issued");
});

test("refuses an amount above the charged total", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });

  const out = await refund({
    orderId,
    amountPaise: CHARGED + 1,
    reason: "generous",
    reasoning: "testing the ceiling",
    confirm: true,
  });

  assert.equal(out.success, false);
  assert.match(String(out.error), /exceeds/i);
  assert.equal(await statusOf(orderId), "delivered", "a refused refund must not move the status");
  assert.deepEqual(await refundEventsFor(orderId), []);
});

test("falls back to the meal total on a legacy row with no charge_paise", async () => {
  // Guest-checkout and pre-charge_paise rows: total_paise already includes
  // GST and the fee, so it IS the charged amount for these.
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: null });

  const ok = await refund({
    orderId,
    amountPaise: SUBTOTAL,
    reason: "cancelled after payment",
    reasoning: "kitchen could not fulfil",
    confirm: true,
  });
  assert.equal(ok.success, true, `expected success, got: ${JSON.stringify(ok)}`);
});

// ---------------------------------------------------------------------------
// Defect 2 — the cap nets off refunds already issued
// ---------------------------------------------------------------------------

test("a second full refund is refused — the cap is on the order, not the call", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });

  const first = await refund({
    orderId,
    amountPaise: CHARGED,
    reason: "order never arrived",
    reasoning: "first payout",
    confirm: true,
  });
  assert.equal(first.success, true, `expected success, got: ${JSON.stringify(first)}`);

  // The same call again. Before the fix this compared CHARGED against the
  // order total afresh, matched, and paid out a second time — an unbounded
  // hole, since nothing about the call changes between attempts.
  const second = await refund({
    orderId,
    amountPaise: CHARGED,
    reason: "order never arrived",
    reasoning: "retried tool call",
    confirm: true,
  });

  assert.equal(second.success, false);
  assert.match(String(second.error), /already been refunded in full/i);
  assert.equal(
    (await refundEventsFor(orderId)).length,
    1,
    "the refused second refund must not append a refund event",
  );
});

test("a refund the refunds console issued is netted off — both event dialects are read", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });
  // routes/refunds.ts records this shape on a successful gateway refund.
  await seedRefundEvent(orderId, "order_refunded", {
    refundRequestId: 4242,
    amountPaise: CHARGED,
    razorpayRefundId: "rfnd_test_console",
    approvedBy: "human-operator",
  });

  const out = await refund({
    orderId,
    amountPaise: CHARGED,
    reason: "customer says they were not refunded",
    reasoning: "double-checking on the customer's word",
    confirm: true,
  });

  // Reading only `refund_issued` would net off nothing here and pay the whole
  // charge out a second time, against an order the console had already
  // refunded in full through the real gateway.
  assert.equal(out.success, false);
  assert.match(String(out.error), /already been refunded in full/i);
  assert.equal(
    (await refundEventsFor(orderId)).length,
    1,
    "only the pre-existing console event should remain",
  );
});

test("partial refunds net rather than latch — a second partial is still allowed", async () => {
  // The netting fix is deliberately not a status guard. This order is already
  // in status `refunded` from a partial payout, and a legitimate top-up of the
  // remainder must still go through; a "refuse if status = refunded" guard
  // would have blocked it.
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });
  await seedRefundEvent(orderId, "order_refunded", { amountPaise: 20000 });
  await db.update(ordersTable).set({ status: "refunded" }).where(eq(ordersTable.id, orderId));

  const remainder = CHARGED - 20000;

  const tooMuch = await refund({
    orderId,
    amountPaise: remainder + 1,
    reason: "top-up",
    reasoning: "one paise over the remainder",
    confirm: true,
  });
  assert.equal(tooMuch.success, false);
  assert.match(String(tooMuch.error), /exceeds the 31200 paise still refundable/i);

  const exact = await refund({
    orderId,
    amountPaise: remainder,
    reason: "top-up to full",
    reasoning: "returning the balance the console did not",
    confirm: true,
  });
  assert.equal(exact.success, true, `expected success, got: ${JSON.stringify(exact)}`);
  assert.equal((await refundEventsFor(orderId)).length, 2);
});

test("an unreadable refund history refuses rather than assuming zero", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });
  // A refund event with no readable amount. Ignoring it would under-count what
  // has gone back and over-permit what may go back next.
  await seedRefundEvent(orderId, "refund_issued", { reason: "late", operatorId: "someone" });

  const out = await refund({
    orderId,
    amountPaise: 100,
    reason: "goodwill",
    reasoning: "small gesture",
    confirm: true,
  });

  assert.equal(out.success, false);
  assert.match(String(out.error), /Cannot establish how much of order/i);
  assert.match(String(out.error), /refunds console/i);
  assert.equal(
    (await refundEventsFor(orderId)).length,
    1,
    "the refused refund must not append an event",
  );
});

test("an order with no resolvable payable amount refuses", async () => {
  // total_paise is NOT NULL in the schema, so the only way to reach an
  // unresolvable amount is a zero/negative total with no charge_paise. It is
  // reachable — a fully credit-covered order writes total_paise 0 — and a
  // refund against it must not fall through to "cap of zero, so 0 is fine".
  const orderId = await seedOrder({ totalPaise: 0, chargePaise: null });

  const out = await refund({
    orderId,
    amountPaise: 100,
    reason: "goodwill",
    reasoning: "small gesture on a zero-value order",
    confirm: true,
  });

  assert.equal(out.success, false);
  assert.match(String(out.error), /Cannot establish how much of order/i);
  assert.equal(await statusOf(orderId), "delivered");
});

// ---------------------------------------------------------------------------
// The surrounding guards these changes must not have disturbed
// ---------------------------------------------------------------------------

test("without confirm:true nothing is read or written", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });

  const out = await refund({
    orderId,
    amountPaise: CHARGED,
    reason: "order never arrived",
    reasoning: "first pass, unconfirmed",
  });

  assert.equal(out.requiresConfirmation, true);
  assert.equal(out.success, undefined);
  assert.equal(await statusOf(orderId), "delivered");
  assert.deepEqual(await refundEventsFor(orderId), []);
});

test("a confirmed refund on a missing order reports not found", async () => {
  const out = await refund({
    orderId: 2_000_000_000,
    amountPaise: 100,
    reason: "typo in the order id",
    reasoning: "operator pasted the wrong number",
    confirm: true,
  });

  assert.equal(out.success, false);
  assert.equal(out.error, "Order not found");
});

test("a successful refund still writes its ops-audit row", async () => {
  const orderId = await seedOrder({ totalPaise: SUBTOTAL, chargePaise: CHARGED });
  await refund({
    orderId,
    amountPaise: 10000,
    reason: "missing side dish",
    reasoning: "partial goodwill refund",
    confirm: true,
  });

  const audits = await db
    .select({ action: opsActionsTable.action, params: opsActionsTable.params })
    .from(opsActionsTable)
    .where(eq(opsActionsTable.operatorId, CTX.userId!));
  const mine = audits.filter(
    (a) => a.action === "refund_order" && (a.params as { orderId?: number }).orderId === orderId,
  );
  assert.equal(mine.length, 1, "the refund must leave exactly one audit row");
});
