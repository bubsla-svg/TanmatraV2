/**
 * Locks `orders.order_channel` — the own-app-vs-aggregator discriminator — to
 * the shape the rest of the system assumes.
 *
 * The failure this prevents is drift between two things that must agree but
 * live twenty lines apart: the `orderChannelValues` tuple (what TypeScript
 * lets a writer set) and the `orders_order_channel_chk` check constraint (what
 * Postgres lets any writer set, including raw SQL and backfill scripts). Add a
 * channel to the tuple and forget the constraint and every insert of it fails
 * in production; add it to the constraint and forget the tuple and the value
 * becomes unreachable from application code. Neither is caught by typecheck,
 * both are caught here.
 *
 * No database required — this reads Drizzle's compiled table config, so it
 * runs in the plain unit-test lane rather than the money-integration job.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/orderChannel.schema.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import {
  ordersTable,
  insertOrderSchema,
  orderChannelValues,
  orderKindValues,
} from "@workspace/db/schema";

const config = getTableConfig(ordersTable);
const dialect = new PgDialect();

function checkConstraintSql(name: string): string {
  const found = config.checks.find((c) => c.name === name);
  assert.ok(found, `check constraint ${name} is missing from ordersTable`);
  return dialect.sqlToQuery(found.value).sql;
}

/**
 * Pulls the quoted literals out of an `<col> in ('a','b')` constraint body so
 * the assertion compares the *set* the database accepts, not the exact string —
 * reordering the list or reformatting the SQL should not fail this test, only
 * a genuine difference in membership should.
 */
function literalsIn(sql: string): string[] {
  const matches = sql.match(/'([^']*)'/g) ?? [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

test("orders_order_channel_chk accepts exactly the orderChannelValues tuple", () => {
  assert.deepEqual(
    literalsIn(checkConstraintSql("orders_order_channel_chk")),
    [...orderChannelValues].sort(),
  );
});

test("orders_order_kind_chk accepts exactly the orderKindValues tuple", () => {
  assert.deepEqual(
    literalsIn(checkConstraintSql("orders_order_kind_chk")),
    [...orderKindValues].sort(),
  );
});

test("order_channel defaults to own_app and is NOT NULL", () => {
  const column = config.columns.find((c) => c.name === "order_channel");
  assert.ok(column, "orders.order_channel column is missing");
  // Every row that predates this column is one of ours, so the backfill is the
  // default. A nullable column would reintroduce exactly the ambiguity the
  // column exists to remove: "channel unknown" and "our own app" must not be
  // the same state.
  assert.equal(column.default, "own_app");
  assert.equal(column.notNull, true);
});

test("varchar width fits every channel value", () => {
  const column = config.columns.find((c) => c.name === "order_channel");
  const width = Number(/varchar\((\d+)\)/.exec(column!.getSQLType())?.[1]);
  assert.ok(Number.isFinite(width), "order_channel is not a bounded varchar");
  const longest = Math.max(...orderChannelValues.map((v) => v.length));
  assert.ok(
    width >= longest,
    `varchar(${width}) cannot hold the longest channel value (${longest} chars)`,
  );
});

test("insertOrderSchema rejects a channel the check constraint would reject", () => {
  // drizzle-zod generates from the SQL type and ignores `$type<>`, so this
  // only holds because insertOrderSchema explicitly refines the column. If
  // that refinement is ever dropped the Zod layer silently reopens and this
  // test is the thing that notices.
  const base = {
    totalPaise: 100,
    items: [] as Array<{ id: number; name: string; qty: number; price: number }>,
  };
  assert.equal(insertOrderSchema.safeParse({ ...base, orderChannel: "ubereats" }).success, false);
  assert.equal(insertOrderSchema.safeParse({ ...base, orderChannel: "Zomato" }).success, false);
  assert.equal(insertOrderSchema.safeParse({ ...base, orderChannel: "" }).success, false);
  for (const channel of orderChannelValues) {
    assert.equal(
      insertOrderSchema.safeParse({ ...base, orderChannel: channel }).success,
      true,
      `insertOrderSchema should accept ${channel}`,
    );
  }
  // Omitting it stays legal — the column default is what backfills.
  assert.equal(insertOrderSchema.safeParse(base).success, true);
});

test("no channel value collides with an order-kind value", () => {
  // orderKind and orderChannel are orthogonal axes that both live in a
  // varchar(16). Overlapping vocabularies would make a mixed-up column
  // assignment silently pass both check constraints instead of erroring.
  const overlap = orderChannelValues.filter((v) =>
    (orderKindValues as readonly string[]).includes(v),
  );
  assert.deepEqual(overlap, []);
});
