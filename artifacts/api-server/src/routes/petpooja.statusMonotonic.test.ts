/**
 * The three Petpooja status webhooks must not walk an order backwards.
 *
 * Webhook delivery is at-least-once and unordered, and all three routes used to
 * write whatever status arrived. That made an order's state a function of
 * ARRIVAL order rather than of what happened to the food, with consequences
 * that are not cosmetic:
 *
 *   - `rider_assigned` is in dispatch.ts's partnerStatuses, so an order dragged
 *     back into it becomes eligible to be batched onto a new delivery — after
 *     it has already left the kitchen.
 *   - `preparing` is on the KDS queue, so a delivered meal dragged back into it
 *     reappears as a ticket to cook.
 *
 * The truth table for the classifier itself lives in
 * lib/petpooja.transition.test.ts and needs no database. This file is about
 * what the routes DO with each verdict, which is where the interesting mistakes
 * are: a refusal that still returns 200 (so the vendor stops retrying), a
 * refusal that declines the webhook's rider data too, and a `hold` that still
 * accepts a reassignment.
 *
 * Every refusal test is paired with a same-shaped control that must still be
 * applied, so a pass is attributable to the guard rather than to the route
 * having stopped writing anything at all.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/routes/petpooja.statusMonotonic.test.ts
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
import { eq, inArray, sql } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { db, ordersTable, ridersTable } from "@workspace/db";

import petpoojaRouter from "./petpooja";

const RUN = randomUUID().slice(0, 8);
const ext = (name: string) => `PPM-${name}-${RUN}`;
const phone = (name: string) => `+9188${RUN}${name}`.slice(0, 20);

const CREATED_EXTERNAL_IDS: string[] = [];
const CREATED_RIDER_PHONES: string[] = [];

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: Record<string, (...a: unknown[]) => void> }).log = {
      error: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
    };
    next();
  });
  app.use(petpoojaRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";

await new Promise<void>((resolve) => {
  server = http.createServer(makeApp()).listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Orders first — they carry rider_id, so the rider delete would be an FK
  // violation the other way round, and a failing hook masks the results.
  if (CREATED_EXTERNAL_IDS.length > 0) {
    await db
      .delete(ordersTable)
      .where(inArray(ordersTable.externalOrderId, CREATED_EXTERNAL_IDS));
  }
  if (CREATED_RIDER_PHONES.length > 0) {
    await db.delete(ridersTable).where(inArray(ridersTable.phone, CREATED_RIDER_PHONES));
  }
});

/**
 * Seed one POS order sitting at a given status. `status` is typed loosely on
 * purpose: one test needs to plant a legacy value that is not in the
 * vocabulary, which is precisely the case the guard has to survive — see
 * `seedPreConstraintOrder`, which is what makes that still possible.
 */
async function seedOrder(opts: {
  externalOrderId: string;
  status: string;
  riderId?: number;
  deliveryInstructions?: string;
}): Promise<number> {
  CREATED_EXTERNAL_IDS.push(opts.externalOrderId);
  const [row] = await db
    .insert(ordersTable)
    .values({
      userId: null,
      orderChannel: "zomato",
      orderKind: "meal",
      externalOrderId: opts.externalOrderId,
      status: opts.status,
      totalPaise: 42500,
      items: [],
      fulfillmentType: "delivery",
      riderId: opts.riderId ?? null,
      deliveryInstructions: opts.deliveryInstructions ?? null,
    })
    .returning({ id: ordersTable.id });
  return row!.id;
}

/**
 * Seed an order holding a status the database no longer accepts.
 *
 * Migration 0015 added `orders_status_chk`, so a plain INSERT of "confirmed"
 * is now refused — which is the entire point of it, and which would otherwise
 * delete the one test below that covers the rows the constraint deliberately
 * says nothing about. It is added `NOT VALID`: rows written before it existed
 * are not scanned and may still hold anything, and until an owner runs
 * `VALIDATE CONSTRAINT` such a row can be sitting in production right now.
 * The guard has to survive meeting one.
 *
 * So the seed reconstructs the only way such a row can exist: it is written
 * while the constraint is not there. Dropping and re-adding it inside a
 * transaction is what makes that faithful rather than a bypass — the DDL takes
 * ACCESS EXCLUSIVE for the duration, so no concurrent session ever observes
 * the table unconstrained, and the constraint is restored whether the insert
 * succeeds or throws.
 *
 * The re-added definition is rendered from the Drizzle table config rather than
 * pasted, so this cannot drift into restoring a narrower or wider constraint
 * than the schema declares.
 *
 * It comes back NOT VALID, and it has to: the row this helper just wrote is
 * exactly the kind a full scan would reject, so a plain ADD CONSTRAINT here
 * would fail. If the test database had been promoted with VALIDATE CONSTRAINT
 * beforehand, running this file demotes it — visible in `pg_constraint`, and
 * harmless, since the `after` hook deletes the row and a re-validate is one
 * statement away.
 */
async function seedPreConstraintOrder(opts: {
  externalOrderId: string;
  status: string;
}): Promise<number> {
  const check = getTableConfig(ordersTable).checks.find((c) => c.name === "orders_status_chk");
  assert.ok(check, "orders_status_chk is missing from ordersTable — has migration 0015 been reverted?");
  const body = new PgDialect().sqlToQuery(check.value).sql;

  CREATED_EXTERNAL_IDS.push(opts.externalOrderId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`alter table orders drop constraint if exists orders_status_chk`);
    const [row] = await tx
      .insert(ordersTable)
      .values({
        userId: null,
        orderChannel: "zomato",
        orderKind: "meal",
        externalOrderId: opts.externalOrderId,
        status: opts.status,
        totalPaise: 42500,
        items: [],
        fulfillmentType: "delivery",
      })
      .returning({ id: ordersTable.id });
    await tx.execute(
      sql`alter table orders add constraint orders_status_chk check (${sql.raw(body)}) not valid`,
    );
    return row!.id;
  });
}

async function seedRider(label: string): Promise<{ id: number; phone: string }> {
  const p = phone(label);
  CREATED_RIDER_PHONES.push(p);
  const [row] = await db
    .insert(ridersTable)
    .values({ name: `Rider ${label}`, phone: p, zone: "default", status: "active" })
    .returning({ id: ridersTable.id });
  return { id: row!.id, phone: p };
}

async function orderRow(id: number) {
  const [row] = await db
    .select({
      status: ordersTable.status,
      riderId: ordersTable.riderId,
      deliveryInstructions: ordersTable.deliveryInstructions,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);
  return row!;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}/integrations/petpooja/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

const CREDS = { app_key: "test", app_secret: "test", access_token: "test" };

const callback = (o: {
  orderID: string;
  status: string;
  rider_name?: string;
  rider_phone_number?: string;
}) => ({ restID: "cq5hnj3629", ...o });

const orderstatus = (o: { clientorderID: string; status: string; cancelReason?: string }) => ({
  ...CREDS,
  restID: "cq5hnj3629",
  cancelReason: "",
  ...o,
});

const riderInfo = (o: {
  order_id: string;
  status: string;
  rider_name?: string;
  rider_phone_number?: string;
}) => ({
  ...CREDS,
  outlet_id: "cq5hnj3629",
  order_id: o.order_id,
  status: o.status,
  ...(o.rider_name && o.rider_phone_number
    ? { rider_data: { rider_name: o.rider_name, rider_phone_number: o.rider_phone_number } }
    : {}),
});

// ---------------------------------------------------------------------------
// /callback
// ---------------------------------------------------------------------------

test("/callback — a replayed accept cannot pull a moving order back to preparing", async () => {
  const id = ext("cb-replay");
  const orderId = await seedOrder({ externalOrderId: id, status: "out_for_delivery" });

  // Petpooja status "1" is Accepted, which maps to `preparing` — one rung below
  // where this order already is. Before the guard this wrote straight through
  // and the order reappeared on the KDS board while the rider was en route.
  const res = await post("callback", callback({ orderID: id, status: "1" }));

  // 200, not 4xx: a non-2xx is read as "did not arrive" and earns a retry loop
  // for a webhook we are deliberately ignoring.
  assert.equal(res.status, 200);
  assert.equal(res.json.success, "1");
  assert.equal((await orderRow(orderId)).status, "out_for_delivery", "the order moved backwards");
});

test("/callback — the forward control still applies", async () => {
  // Without this, a route that had simply stopped writing would pass the test
  // above perfectly.
  const id = ext("cb-forward");
  const orderId = await seedOrder({ externalOrderId: id, status: "placed" });

  const res = await post("callback", callback({ orderID: id, status: "1" }));

  assert.equal(res.status, 200);
  assert.equal((await orderRow(orderId)).status, "preparing", "a legitimate advance was refused");
});

test("/callback — an outlet may cancel a live order, but not a delivered one", async () => {
  // `cancelled` has no ladder rank, so it is special-cased as an advance from
  // any live rung. The two halves of that rule are only meaningful together.
  const liveId = ext("cb-cancel-live");
  const liveOrder = await seedOrder({ externalOrderId: liveId, status: "preparing" });
  await post("callback", callback({ orderID: liveId, status: "-1" }));
  assert.equal((await orderRow(liveOrder)).status, "cancelled", "a live cancellation was refused");

  const doneId = ext("cb-cancel-done");
  const doneOrder = await seedOrder({ externalOrderId: doneId, status: "delivered" });
  const res = await post("callback", callback({ orderID: doneId, status: "-1" }));
  assert.equal(res.status, 200);
  assert.equal(
    (await orderRow(doneOrder)).status,
    "delivered",
    "a meal already with the customer was cancelled"
  );
});

test("/callback — a refused webhook does not attach its rider either", async () => {
  // The rule is "write nothing", not "write everything except the status". The
  // ladder is the only evidence of ordering we have, so a webhook that
  // contradicts it is not a trustworthy source for its other fields — and a row
  // assembled from two different moments is harder to reason about than one
  // that was simply left alone.
  const id = ext("cb-refuse-rider");
  const orderId = await seedOrder({ externalOrderId: id, status: "delivered" });
  const stalePhone = phone("stale");
  CREATED_RIDER_PHONES.push(stalePhone);

  await post(
    "callback",
    callback({
      orderID: id,
      status: "1",
      rider_name: "Stale Courier",
      rider_phone_number: stalePhone,
    })
  );

  const row = await orderRow(orderId);
  assert.equal(row.status, "delivered");
  assert.equal(row.riderId, null, "a refused webhook still wrote its rider onto the order");

  const riders = await db.select().from(ridersTable).where(eq(ridersTable.phone, stalePhone));
  assert.equal(riders.length, 0, "a refused webhook still created a rider row");
});

// ---------------------------------------------------------------------------
// /rider-info
// ---------------------------------------------------------------------------

test("/rider-info — the pickedup / rider-assigned race resolves forward", async () => {
  // The concrete out-of-order case: `pickedup` (→ out_for_delivery) arrives
  // first, then the `rider-assigned` that logically preceded it. Applying the
  // second would put a moving order back into partnerStatuses, where the
  // batcher can staple another delivery onto it.
  const id = ext("ri-race");
  const orderId = await seedOrder({ externalOrderId: id, status: "out_for_delivery" });

  const res = await post("rider-info", riderInfo({ order_id: id, status: "rider-assigned" }));

  assert.equal(res.status, 200);
  assert.equal(res.json.success, "success");
  assert.equal((await orderRow(orderId)).status, "out_for_delivery", "the order moved backwards");
});

test("/rider-info — a reassignment on the same rung still lands", async () => {
  // This is why `hold` is a distinct outcome from `regress`. Two
  // `rider-assigned` events for one order is not a duplicate — it is how a
  // courier swap arrives. The status does not move; the courier must.
  const first = await seedRider("first");
  const second = await seedRider("second");
  const id = ext("ri-reassign");
  const orderId = await seedOrder({
    externalOrderId: id,
    status: "rider_assigned",
    riderId: first.id,
  });

  await post(
    "rider-info",
    riderInfo({
      order_id: id,
      status: "rider-assigned",
      rider_name: "Rider second",
      rider_phone_number: second.phone,
    })
  );

  const row = await orderRow(orderId);
  assert.equal(row.status, "rider_assigned");
  assert.equal(row.riderId, second.id, "a reassignment was dropped as a duplicate");
});

test("/rider-info — the forward control still applies", async () => {
  const rider = await seedRider("forward");
  const id = ext("ri-forward");
  const orderId = await seedOrder({ externalOrderId: id, status: "ready" });

  await post(
    "rider-info",
    riderInfo({
      order_id: id,
      status: "rider-assigned",
      rider_name: "Rider forward",
      rider_phone_number: rider.phone,
    })
  );

  const row = await orderRow(orderId);
  assert.equal(row.status, "rider_assigned", "a legitimate assignment was refused");
  assert.equal(row.riderId, rider.id);
});

// ---------------------------------------------------------------------------
// /orderstatus
// ---------------------------------------------------------------------------

test("/orderstatus — a replayed cancellation does not prepend its reason twice", async () => {
  // The cancellation reason is written by prepending to delivery_instructions,
  // which is not idempotent. Applying it on a replay produced
  // "[Cancelled: X] [Cancelled: X] …", eating the customer's real instructions
  // 512 characters at a time. It now belongs to the `advance` branch only —
  // the reason describes the cancellation EVENT, not the cancelled state.
  const id = ext("os-cancel-twice");
  const orderId = await seedOrder({
    externalOrderId: id,
    status: "preparing",
    deliveryInstructions: "Ring the bell twice",
  });

  await post(
    "orderstatus",
    orderstatus({ clientorderID: id, status: "-1", cancelReason: "Out of stock" })
  );
  const afterFirst = await orderRow(orderId);
  assert.equal(afterFirst.status, "cancelled");
  assert.match(afterFirst.deliveryInstructions ?? "", /^\[Cancelled: Out of stock\]/);
  assert.match(afterFirst.deliveryInstructions ?? "", /Ring the bell twice/);

  const replay = await post(
    "orderstatus",
    orderstatus({ clientorderID: id, status: "-1", cancelReason: "Out of stock" })
  );
  assert.equal(replay.status, 200);

  const afterReplay = await orderRow(orderId);
  assert.equal(
    afterReplay.deliveryInstructions,
    afterFirst.deliveryInstructions,
    "the replay rewrote the delivery instructions"
  );
  const occurrences = (afterReplay.deliveryInstructions ?? "").split("[Cancelled:").length - 1;
  assert.equal(occurrences, 1, `the cancel reason was prepended ${occurrences} times`);
});

test("/orderstatus — an order holding a legacy status is left alone", async () => {
  // "confirmed" and "dispatched" were really written by the old, untyped
  // Petpooja mappers, at a time when orders.status had no check constraint to
  // stop them. Migration 0015 closed that door for every write from now on, but
  // added the constraint NOT VALID — so it makes no claim about rows already
  // there, and one of them can still be sitting in production holding a value
  // this system does not recognise. That row is what this test is about.
  //
  // Such a row cannot be placed on the ladder, so the guard fails closed. That
  // is deliberately conservative: the repair is a decision someone makes on
  // purpose, per row and with its age in front of them (see
  // `pnpm --filter @workspace/scripts run audit-order-status`), not a webhook
  // silently guessing where a months-old order belongs and putting a meal that
  // was eaten in March back on the KDS board.
  const id = ext("os-legacy");
  const orderId = await seedPreConstraintOrder({ externalOrderId: id, status: "confirmed" });

  const res = await post("orderstatus", orderstatus({ clientorderID: id, status: "6" }));

  assert.equal(res.status, 200);
  assert.equal(res.json.success, "1");
  assert.equal((await orderRow(orderId)).status, "confirmed", "an unplaceable row was moved anyway");
});

test("/orderstatus — the forward control still applies", async () => {
  const id = ext("os-forward");
  const orderId = await seedOrder({ externalOrderId: id, status: "out_for_delivery" });

  const res = await post("orderstatus", orderstatus({ clientorderID: id, status: "6" }));

  assert.equal(res.status, 200);
  assert.equal((await orderRow(orderId)).status, "delivered", "a legitimate advance was refused");
});
