/**
 * Integration tests locking the paid-liveness gate on the ops agent's
 * `update_order_status` tool.
 *
 * The tool used to refuse only a literal current status of "placed"
 * (`order.status === "placed" && status !== "cancelled"`), which is a
 * negative check: it excludes exactly one string and lets everything else —
 * including the TERMINAL statuses "delivered" and "cancelled" — fall through
 * to an unconditional status UPDATE. An operator (or the LLM driving this
 * tool from a misread chat message) could walk an already-delivered or
 * already-cancelled order back into "preparing", re-entering the kitchen/
 * dispatch pipeline for an order payment considers closed.
 *
 * The fix replaces that with a positive lib/paidGate.ts `isPaidLive` check
 * (plus the one deliberate carve-out: placed→cancelled, so ops can still
 * kill unpaid junk). These tests pin both the carve-out and the two
 * terminal-status holes it used to leave open.
 *
 * These call the tool's handler directly rather than driving the LLM: the
 * handler is the trust boundary, and a test that had to coax a model into
 * emitting a tool call would be pinning the model, not the guard.
 *
 * Needs DATABASE_URL (CI: money-integration job's Postgres service).
 *
 * Run with:
 *   node --test --import tsx ./src/lib/ai/agents/ops.updateOrderStatus.test.ts
 */

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { db, deliveryEventsTable, opsActionsTable, ordersTable, usersTable } from "@workspace/db";

import { getAgent } from "../agentRegistry";
import type { ToolContext } from "../tools";
import "./ops";

const RUN = randomUUID().slice(0, 8);

const opsAgent = getAgent("ops");
assert.ok(opsAgent, "ops agent is not registered");
const statusTool = opsAgent.tools.find((t) => t.name === "update_order_status");
assert.ok(statusTool, "ops agent has no update_order_status tool");
const statusHandler = statusTool.handler;

interface StatusInput {
  orderId: number;
  status: string;
  reasoning: string;
  confirm?: boolean;
}

interface StatusOutput {
  success?: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  status?: string;
  previous?: string;
}

const CTX: ToolContext = {
  userId: `ops-operator-uos-${RUN}`,
  agent: "ops",
  isOps: true,
  isCatalog: false,
};

async function updateStatus(input: StatusInput): Promise<StatusOutput> {
  return (await statusHandler(input, CTX)) as StatusOutput;
}

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
    email: `uos-${label}-${id}@example.test`,
    firstName: label,
  });
  CREATED_USER_IDS.push(id);
  return id;
}

const userId = await makeUser("subject");

async function seedOrder(status: string): Promise<number> {
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId,
      externalOrderId: `TAN-UOS-${randomUUID().slice(0, 8)}-${RUN}`,
      status,
      totalPaise: 40000,
      chargePaise: 51200,
      orderKind: "meal",
      orderChannel: "own_app",
      items: [{ id: 31, name: "Moong Khichdi", qty: 2, price: 21000 }],
      fulfillmentType: "delivery",
      pincode: "560001",
      addressLine: "12 Test Lane",
      city: "Bengaluru",
      phone: "+919000000002",
      priority: "routine",
    })
    .returning({ id: ordersTable.id });
  CREATED_ORDER_IDS.push(row!.id);
  return row!.id;
}

async function statusOf(orderId: number): Promise<string | undefined> {
  const [row] = await db
    .select({ status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  return row?.status;
}

test("refuses to advance an unpaid ('placed') order", async () => {
  const orderId = await seedOrder("placed");
  const out = await updateStatus({
    orderId,
    status: "preparing",
    reasoning: "test",
  });
  assert.equal(out.success, false);
  assert.match(String(out.error), /not in a paid-live status/i);
  assert.equal(await statusOf(orderId), "placed");
});

test("still allows cancelling an unpaid ('placed') order — the deliberate carve-out", async () => {
  const orderId = await seedOrder("placed");
  const out = await updateStatus({
    orderId,
    status: "cancelled",
    reasoning: "test",
    confirm: true,
  });
  assert.equal(out.success, true, `expected success, got: ${JSON.stringify(out)}`);
  assert.equal(await statusOf(orderId), "cancelled");
});

test("refuses to revive a DELIVERED (terminal) order back into the pipeline", async () => {
  // The exact hole the old `!== "placed"` check left open: "delivered" is not
  // "placed", so it fell straight through to an unconditional UPDATE.
  const orderId = await seedOrder("delivered");
  const out = await updateStatus({
    orderId,
    status: "preparing",
    reasoning: "test",
  });
  assert.equal(out.success, false);
  assert.match(String(out.error), /not in a paid-live status/i);
  assert.equal(
    await statusOf(orderId),
    "delivered",
    "a delivered order must not be walked backwards",
  );
});

test("refuses to revive a CANCELLED (terminal) order back into the pipeline", async () => {
  const orderId = await seedOrder("cancelled");
  const out = await updateStatus({
    orderId,
    status: "preparing",
    reasoning: "test",
  });
  assert.equal(out.success, false);
  assert.match(String(out.error), /not in a paid-live status/i);
  assert.equal(
    await statusOf(orderId),
    "cancelled",
    "a cancelled order must not be resurrected",
  );
});

test("still advances a genuinely paid-live order (positive control)", async () => {
  // Without this, every test above would also pass if the gate simply
  // blocked every write.
  const orderId = await seedOrder("preparing");
  const out = await updateStatus({
    orderId,
    status: "ready",
    reasoning: "test",
  });
  assert.equal(out.success, true, `expected success, got: ${JSON.stringify(out)}`);
  assert.equal(await statusOf(orderId), "ready");
});
