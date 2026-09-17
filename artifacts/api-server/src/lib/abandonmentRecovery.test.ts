/**
 * Abandonment recovery (T9) — DB-backed, sender and link-creator injected.
 *
 *   (a) a guest order whose sheet was dismissed 10 min ago (placed +
 *       razorpayOrderId) gets ONE payment link for the server amount, to the
 *       order's phone; a second sweep sends nothing (message_dispatches dedupe).
 *   (b) a `failed` order is recovered too; one 2 min old is not yet (grace);
 *       one 2 h old is no longer (window).
 *   (c) a signed-in customer's order is skipped without whatsappUtilityConsentAt
 *       and sent with it.
 *   (d) an order that never reached the sheet (no razorpayOrderId) is not a
 *       candidate.
 *   (e) cart nudge: a known customer with a 70-min-old add_to_cart and no
 *       order since gets one nudge; one who ordered after it does not; one
 *       without consent does not.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/abandonmentRecovery.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { db, funnelEventsTable, messageDispatchesTable, ordersTable, usersTable } from "@workspace/db";
import { isUniqueViolation } from "./whatsapp";
import {
  NUDGE_TEMPLATE,
  RECOVERY_TEMPLATE,
  runCartNudgeSweep,
  runPaymentRecoverySweep,
  type RecoveryDeps,
} from "./abandonmentRecovery";

const USER_IDS: string[] = [];
const ORDER_IDS: number[] = [];
const EVENT_IDS: number[] = [];
const TAG = `t9-${randomUUID().slice(0, 8)}`;

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60_000);
}

async function makeUser(opts: { phone?: string; consent?: boolean } = {}): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `${TAG}-${id}@example.test`,
    firstName: "Recovery",
    lastName: "Tester",
    ...(opts.phone ? { phoneE164: opts.phone } : {}),
    ...(opts.consent ? { whatsappUtilityConsentAt: new Date() } : {}),
  });
  USER_IDS.push(id);
  return id;
}

async function makeOrder(opts: {
  status: string;
  createdAt: Date;
  phone?: string | null;
  userId?: string | null;
  reachedSheet?: boolean;
}): Promise<{ id: number; externalOrderId: string }> {
  const externalOrderId = `${TAG}-${randomUUID().slice(0, 8)}`;
  const [row] = await db
    .insert(ordersTable)
    .values({
      externalOrderId,
      status: opts.status,
      totalPaise: 49900,
      chargePaise: 49900,
      phone: opts.phone === undefined ? "9876543210" : opts.phone,
      userId: opts.userId ?? null,
      razorpayOrderId: opts.reachedSheet === false ? null : `order_${randomUUID().slice(0, 12)}`,
      createdAt: opts.createdAt,
      items: [{ id: 1, name: "Quinoa Khichdi", qty: 1, price: 49900 }],
    })
    .returning({ id: ordersTable.id });
  ORDER_IDS.push(row!.id);
  return { id: row!.id, externalOrderId };
}

interface Sent { e164: string; body: string; dedupe: { userId: string; templateId: string; serviceDate: string } }

function harness() {
  const sent: Sent[] = [];
  const links: string[] = [];
  const deps: RecoveryDeps = {
    createLink: async (r) => {
      links.push(r.externalOrderId);
      return { id: `plink_${r.externalOrderId}`, shortUrl: `https://rzp.io/l/${r.externalOrderId}`, expiresAt: new Date(Date.now() + r.expireInSec * 1000) };
    },
    sendMessage: async (n, body, dedupe) => {
      // Mirror the real sender's dedupe contract: the dispatch row is what
      // stops a second send.
      try {
        await db.insert(messageDispatchesTable).values({ ...dedupe, dedupeKey: `${dedupe.userId}:${dedupe.templateId}:${dedupe.serviceDate}` });
      } catch (e) {
        if (isUniqueViolation(e)) return { ok: true, discarded: true };
        throw e;
      }
      sent.push({ e164: n.e164, body, dedupe });
      return { ok: true, mock: true };
    },
    storefrontOrigin: "https://tanmatra.food",
  };
  return { sent, links, deps };
}

function mine(sent: Sent[], ids: string[]): Sent[] {
  return sent.filter((s) => ids.some((id) => s.dedupe.userId === id || s.body.includes(id)));
}

test("(a) dismissed guest order → one payment link to the order phone, deduped on the second sweep", async () => {
  const order = await makeOrder({ status: "placed", createdAt: minutesAgo(10) });
  const h = harness();
  await runPaymentRecoverySweep(h.deps);
  const got = mine(h.sent, [order.externalOrderId, `order:${order.id}`]);
  assert.equal(got.length, 1);
  assert.equal(got[0]!.e164, "+919876543210");
  assert.match(got[0]!.body, /₹499/);
  assert.match(got[0]!.body, new RegExp(`https://rzp.io/l/${order.externalOrderId}`));
  assert.match(got[0]!.body, /full refund/i);
  assert.equal(got[0]!.dedupe.templateId, RECOVERY_TEMPLATE);
  assert.ok(h.links.includes(order.externalOrderId));

  const again = harness();
  await runPaymentRecoverySweep(again.deps);
  assert.equal(mine(again.sent, [order.externalOrderId, `order:${order.id}`]).length, 0);
  assert.ok(!again.links.includes(order.externalOrderId), "no second live link is minted for a deduped order");
});

test("(b) a failed order is recovered; too young and too old are not", async () => {
  const failed = await makeOrder({ status: "failed", createdAt: minutesAgo(12) });
  const young = await makeOrder({ status: "placed", createdAt: minutesAgo(2) });
  const old = await makeOrder({ status: "placed", createdAt: minutesAgo(120) });
  const h = harness();
  await runPaymentRecoverySweep(h.deps);
  assert.ok(h.links.includes(failed.externalOrderId));
  assert.ok(!h.links.includes(young.externalOrderId));
  assert.ok(!h.links.includes(old.externalOrderId));
});

test("(c) a signed-in customer's order needs whatsappUtilityConsentAt", async () => {
  const noConsent = await makeUser({ phone: "+919000000001" });
  const consented = await makeUser({ phone: "+919000000002", consent: true });
  const a = await makeOrder({ status: "placed", createdAt: minutesAgo(10), userId: noConsent, phone: null });
  const b = await makeOrder({ status: "placed", createdAt: minutesAgo(10), userId: consented, phone: null });
  const h = harness();
  await runPaymentRecoverySweep(h.deps);
  assert.ok(!h.links.includes(a.externalOrderId));
  assert.ok(h.links.includes(b.externalOrderId));
  const got = mine(h.sent, [consented]);
  assert.equal(got.length, 1);
  assert.equal(got[0]!.e164, "+919000000002", "falls back to the account phone when the order carries none");
});

test("(d) an order that never reached the sheet is not a candidate", async () => {
  const never = await makeOrder({ status: "placed", createdAt: minutesAgo(10), reachedSheet: false });
  const h = harness();
  await runPaymentRecoverySweep(h.deps);
  assert.ok(!h.links.includes(never.externalOrderId));
});

test("(e) cart nudge: 60–90 min old add_to_cart, no order since, consent on file", async () => {
  const idle = await makeUser({ phone: "+919000000010", consent: true });
  const ordered = await makeUser({ phone: "+919000000011", consent: true });
  const silent = await makeUser({ phone: "+919000000012", consent: false });
  const fresh = await makeUser({ phone: "+919000000013", consent: true });
  for (const [userId, age] of [[idle, 70], [ordered, 70], [silent, 70], [fresh, 20]] as const) {
    const [ev] = await db
      .insert(funnelEventsTable)
      .values({ name: "add_to_cart", userId, props: { dish_id: "x" }, createdAt: minutesAgo(age) })
      .returning({ id: funnelEventsTable.id });
    EVENT_IDS.push(ev!.id);
  }
  await makeOrder({ status: "preparing", createdAt: minutesAgo(30), userId: ordered });

  const h = harness();
  await runCartNudgeSweep(h.deps);
  const got = mine(h.sent, [idle, ordered, silent, fresh]);
  assert.deepEqual(got.map((s) => s.dedupe.userId), [idle]);
  assert.equal(got[0]!.dedupe.templateId, NUDGE_TEMPLATE);
  assert.match(got[0]!.body, /https:\/\/tanmatra\.food\/checkout\?mode=alacarte/);

  const again = harness();
  const r = await runCartNudgeSweep(again.deps);
  assert.equal(mine(again.sent, [idle]).length, 0, "one nudge per customer per day");
  assert.equal(r.errors, 0, "a deduped send is a skip, not an error");
});

after(async () => {
  if (EVENT_IDS.length) await db.delete(funnelEventsTable).where(inArray(funnelEventsTable.id, EVENT_IDS));
  if (ORDER_IDS.length) await db.delete(ordersTable).where(inArray(ordersTable.id, ORDER_IDS));
  await db.delete(messageDispatchesTable).where(like(messageDispatchesTable.dedupeKey, `order:%`));
  for (const id of USER_IDS) {
    await db.delete(messageDispatchesTable).where(eq(messageDispatchesTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
  }
});
