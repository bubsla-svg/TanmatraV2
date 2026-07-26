/**
 * The WBR's revenue line has always been every channel and every kind, and the
 * commentary has always described it as if it were ours. These tests pin the
 * breakdown that says so.
 *
 * The claim is narrow and load-bearing: `revenueMix` PARTITIONS the headline
 * `revenuePaise` — same rows, no double counting, nothing dropped. If it did
 * not, the caveat sentence would understate or overstate the share of revenue
 * we did not originate, which is worse than not printing one at all. So the
 * partition is asserted against `aggregateWindow`, the function that actually
 * produces the headline, rather than against arithmetic written here.
 *
 * What is deliberately NOT tested is any change to `revenuePaise` itself. This
 * branch reports the mix; whether the headline should exclude aggregator rows
 * is an owner decision (claude/order-channel-split.md §6 row 7), and silently
 * restating a number that has been published to Slack for weeks would be the
 * wrong way to raise it.
 *
 * Needs Postgres (DATABASE_URL). Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/wbr.channel.test.ts
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { inArray } from "drizzle-orm";
import { db, ordersTable, type WbrReport } from "@workspace/db";

import { ensureSafeViews } from "./safeSql";
import { aggregateWindow, mixCaveat, ownAppRevenuePaise, revenueMix } from "./wbr";

// A historical ISO week (Mon 2019-03-04 → Mon 2019-03-11). `node --test` runs
// test FILES concurrently against one database, so the window has to be one no
// other suite writes into; nothing in this repo seeds 2019. The guard in
// `before` turns any future collision into a clear message instead of confusing
// arithmetic three assertions later.
const WEEK_START = new Date("2019-03-04T00:00:00.000Z");
const WEEK_END = new Date("2019-03-11T00:00:00.000Z");
const AT = new Date("2019-03-06T09:00:00.000Z");

// Four distinct amounts, so a slice landing in the wrong bucket shows up as a
// wrong number rather than a coincidence.
const OWN_MEAL_PAISE = 120_000;
const OWN_MARKETPLACE_PAISE = 45_000;
const ZOMATO_PAISE = 78_000;
const SWIGGY_PAISE = 61_000;
const ALL_PAISE = OWN_MEAL_PAISE + OWN_MARKETPLACE_PAISE + ZOMATO_PAISE + SWIGGY_PAISE;
const OURS_PAISE = OWN_MEAL_PAISE + OWN_MARKETPLACE_PAISE;

const seededIds: number[] = [];

before(async () => {
  await ensureSafeViews();

  const existing = await aggregateWindow(WEEK_START, WEEK_END);
  assert.equal(
    existing.orders,
    0,
    `the 2019 test window already has ${existing.orders} order(s) — another suite is writing into it; move this window`,
  );

  // `userId` is left null throughout: it is nullable, an aggregator order
  // genuinely has no user of ours behind it, and creating four users would put
  // this test in the way of every suite that counts them.
  const rows = await db
    .insert(ordersTable)
    .values([
      {
        orderKind: "meal",
        orderChannel: "own_app",
        status: "delivered",
        totalPaise: OWN_MEAL_PAISE,
        items: [{ id: 1, name: "Millet Khichdi", qty: 2, price: 60_000 }],
        createdAt: AT,
      },
      {
        orderKind: "marketplace",
        orderChannel: "own_app",
        status: "delivered",
        totalPaise: OWN_MARKETPLACE_PAISE,
        items: [
          {
            itemId: 9,
            slug: "cold-pressed-oil",
            name: "Cold Pressed Oil",
            qty: 1,
            unitPricePaise: 45_000,
            supplierName: "Test Supplier",
            commissionPaise: 4_500,
            vendorPayoutPaise: 40_500,
          },
        ],
        createdAt: AT,
      },
      {
        orderKind: "meal",
        orderChannel: "zomato",
        status: "delivered",
        totalPaise: ZOMATO_PAISE,
        items: [{ id: 1, name: "Millet Khichdi", qty: 1, price: 60_000 }],
        createdAt: AT,
      },
      {
        orderKind: "meal",
        orderChannel: "swiggy",
        status: "delivered",
        totalPaise: SWIGGY_PAISE,
        items: [{ id: 1, name: "Millet Khichdi", qty: 1, price: 60_000 }],
        createdAt: AT,
      },
    ])
    .returning({ id: ordersTable.id });
  seededIds.push(...rows.map((r) => r.id));
});

after(async () => {
  if (seededIds.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.id, seededIds));
  }
});

test("the headline revenue includes every channel — that is the fact being reported", async () => {
  const window = await aggregateWindow(WEEK_START, WEEK_END);
  assert.equal(window.orders, 4);
  // Not an aspiration: this IS what the WBR publishes as `revenuePaise` today,
  // aggregator rows and marketplace goods included.
  assert.equal(window.revenuePaise, ALL_PAISE);
});

test("revenueMix partitions the headline total exactly", async () => {
  const [window, mix] = await Promise.all([
    aggregateWindow(WEEK_START, WEEK_END),
    revenueMix(WEEK_START, WEEK_END),
  ]);

  const summed = mix.reduce((a, s) => a + s.revenuePaise, 0);
  const counted = mix.reduce((a, s) => a + s.orders, 0);

  // Compared against aggregateWindow, not against ALL_PAISE, so this still
  // holds if the fixture changes — and so a WHERE clause added to one query and
  // not the other fails here rather than in a published number.
  assert.equal(summed, window.revenuePaise);
  assert.equal(counted, window.orders);

  // Partition, not merely a cover: each (channel, kind) appears once, so no row
  // can be counted twice and still sum correctly by cancellation.
  const keys = mix.map((s) => `${s.channel}/${s.orderKind}`);
  assert.equal(new Set(keys).size, keys.length, `duplicate slice: ${keys.join(", ")}`);
  assert.deepEqual([...keys].sort(), [
    "own_app/marketplace",
    "own_app/meal",
    "swiggy/meal",
    "zomato/meal",
  ]);
});

test("ownAppRevenuePaise counts our marketplace orders as ours, and no one else's", async () => {
  const mix = await revenueMix(WEEK_START, WEEK_END);
  const ours = ownAppRevenuePaise(mix);

  // An own-app marketplace order is as much our revenue as an own-app meal is —
  // the channel is the ownership axis, the kind is not. Asserting the sum of
  // both rules out the plausible-looking mistake of filtering to meals here.
  assert.equal(ours, OURS_PAISE);
  assert.ok(ours < ALL_PAISE, "the fixture must contain revenue that is not ours, or it proves nothing");
  assert.equal(ALL_PAISE - ours, ZOMATO_PAISE + SWIGGY_PAISE);
});

test("the caveat names the channels and states both numbers", async () => {
  const mix = await revenueMix(WEEK_START, WEEK_END);
  const sentence = mixCaveat(kpisWith({ revenuePaise: ALL_PAISE, revenueMix: mix, ownAppRevenuePaise: OURS_PAISE }));

  assert.match(sentence, /zomato/);
  assert.match(sentence, /swiggy/);
  // Both figures, in rupees: the part that is not ours and the part that is.
  // A caveat that gave only the percentage would still leave the reader unable
  // to say what our revenue was.
  assert.match(sentence, new RegExp(`₹${(ALL_PAISE - OURS_PAISE) / 100}\\b`));
  assert.match(sentence, new RegExp(`₹${OURS_PAISE / 100}\\b`));
  assert.match(sentence, /45\.7%/);
});

test("a week that is wholly ours reads exactly as it did before this branch", () => {
  const sentence = mixCaveat(
    kpisWith({
      revenuePaise: OWN_MEAL_PAISE,
      revenueMix: [{ channel: "own_app", orderKind: "meal", orders: 1, revenuePaise: OWN_MEAL_PAISE }],
      ownAppRevenuePaise: OWN_MEAL_PAISE,
    }),
  );
  // Empty, not "0% came from elsewhere". The commentary joins on filter(Boolean),
  // so an empty string disappears rather than trailing a limp sentence.
  assert.equal(sentence, "");
});

test("a report written before the mix existed says nothing rather than claiming it was all ours", () => {
  // The dangerous default. `ownAppRevenuePaise` absent means UNKNOWN mix — a
  // reader (or a later chart) that treated it as zero would announce that none
  // of a historical week's revenue was ours; treating it as the full total
  // would announce all of it was. Saying nothing is the only honest option.
  assert.equal(mixCaveat(kpisWith({ revenuePaise: ALL_PAISE })), "");
});

test("a zero-revenue week does not divide by it", () => {
  assert.equal(mixCaveat(kpisWith({ revenuePaise: 0, ownAppRevenuePaise: 0 })), "");
});

function kpisWith(over: Partial<WbrReport["kpis"]>): WbrReport["kpis"] {
  return {
    orders: 4,
    ordersPrev: 0,
    revenuePaise: 0,
    revenuePaisePrev: 0,
    activeCustomers: 0,
    activeCustomersPrev: 0,
    avgOrderPaise: 0,
    topDishes: [],
    anomaliesFired: 0,
    ...over,
  };
}
