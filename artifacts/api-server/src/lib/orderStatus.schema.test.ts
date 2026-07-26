/**
 * Locks `orders.status` — the value every reader in the system branches on — to
 * one vocabulary, declared in one place, enforced in four.
 *
 * This is the test that would have caught the bug that started this work. The
 * Petpooja webhook mappers wrote "confirmed" and "dispatched" into production;
 * neither is in `orderStatusValues`, no reader recognised either, and an order
 * the POS moved to one of them silently dropped out of the customer's
 * active-order list, the dispatch sweep and the storefront tracker at once.
 * Nothing failed. Nothing logged. The order simply stopped existing as far as
 * the app was concerned.
 *
 * The tuple was already right when that happened — it was the only thing that
 * was. So the assertions here are all of the same shape: every other statement
 * of the vocabulary must equal the tuple, as a *set*.
 *
 *   • `orders_status_chk`                  what Postgres accepts, from anyone
 *   • `insertOrderSchema.status`           what Zod accepts, on our write paths
 *   • `isOrderStatus`                      what the runtime fail-closed gate accepts
 *   • `orderStatusLadderRank`              which way time runs between them
 *   • `orderStatusAcceptsExternalUpdate`   which of them a webhook may leave
 *
 * TypeScript already ties the last two to the tuple, because they are
 * `Record<OrderStatus, …>` and a missing or excess key will not compile. It
 * cannot do the same for the first three: the check constraint is a raw SQL
 * string, and `literalsIn` below is the only thing that reads it back. Adding a
 * status to the tuple and forgetting the constraint means every insert of it
 * fails in production; adding it to the constraint and forgetting the tuple
 * makes it unreachable from application code. Neither is a type error, both are
 * a red test here.
 *
 * No database required — this reads Drizzle's compiled table config, so it runs
 * in the plain unit-test lane rather than the money-integration job.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/orderStatus.schema.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import {
  ordersTable,
  insertOrderSchema,
  orderStatusValues,
  orderStatusLadderRank,
  orderStatusAcceptsExternalUpdate,
  isOrderStatus,
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
 * reordering the list or reformatting the SQL should not fail this test, only a
 * genuine difference in membership should.
 */
function literalsIn(sql: string): string[] {
  const matches = sql.match(/'([^']*)'/g) ?? [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

const CONSTRAINT_LITERALS = literalsIn(checkConstraintSql("orders_status_chk"));
const TUPLE = [...orderStatusValues].sort();

test("orders_status_chk accepts exactly the orderStatusValues tuple", () => {
  assert.deepEqual(CONSTRAINT_LITERALS, TUPLE);
});

test("the two statuses that caused this constraint are outside it", () => {
  // Named explicitly rather than left to the set comparison above, because the
  // set comparison would still pass if someone "fixed" the drift by widening
  // the tuple to admit them. That is the wrong repair: `confirmed` is not a
  // state this system has — acceptance IS the start of prep, so it maps to
  // `preparing` — and `dispatched` is `out_for_delivery` under another name.
  // Two spellings of one state is how a reader comes to miss half its rows.
  for (const bogus of ["confirmed", "dispatched"]) {
    assert.ok(
      !CONSTRAINT_LITERALS.includes(bogus),
      `${bogus} must not be admitted to the vocabulary — map it, don't add it`,
    );
    assert.equal(isOrderStatus(bogus), false);
  }
});

test("isOrderStatus accepts exactly what the database accepts", () => {
  // `isOrderStatus` is the runtime gate the fail-closed paths use to decide
  // whether they understand a row they just read. If it and the constraint ever
  // disagree, one of two things is true: a row the database permits is
  // unrecognisable to the code that must act on it, or code is confidently
  // acting on a value no writer can produce.
  for (const legal of CONSTRAINT_LITERALS) {
    assert.equal(isOrderStatus(legal), true, `isOrderStatus should accept ${legal}`);
  }
  assert.equal(isOrderStatus("PLACED"), false, "the vocabulary is case-sensitive");
  assert.equal(isOrderStatus(""), false);
});

test("the ladder and the external-update table cover exactly the vocabulary", () => {
  // The compiler ties these Records to the tuple. Nothing ties the tuple to the
  // constraint but the test above — so assert them against the constraint's own
  // literals, which makes this a check of the whole chain rather than of one
  // link the type system already holds.
  assert.deepEqual(Object.keys(orderStatusLadderRank).sort(), CONSTRAINT_LITERALS);
  assert.deepEqual(Object.keys(orderStatusAcceptsExternalUpdate).sort(), CONSTRAINT_LITERALS);
});

test("every terminal status is off the ladder, and every rank is unique", () => {
  // A duplicate rank would make `classifyPosStatusTransition` treat a real
  // forward move as a no-op, since it compares ranks rather than identities.
  const ranks = Object.values(orderStatusLadderRank).filter((r): r is number => r !== null);
  assert.equal(new Set(ranks).size, ranks.length, "two statuses share a ladder rank");
  // And a status that accepts no further external update has no business
  // having a rung to be moved off of.
  for (const [status, accepts] of Object.entries(orderStatusAcceptsExternalUpdate)) {
    if (accepts) continue;
    if (status === "delivered") continue; // top of the ladder; only our own refund path follows it
    assert.equal(
      orderStatusLadderRank[status as keyof typeof orderStatusLadderRank],
      null,
      `${status} is settled but still has a ladder rank`,
    );
  }
});

test("status defaults to placed and is NOT NULL", () => {
  const column = config.columns.find((c) => c.name === "status");
  assert.ok(column, "orders.status column is missing");
  assert.equal(column.default, "placed");
  assert.equal(column.notNull, true);
  // The default has to be a member of the vocabulary it defaults into —
  // obvious, and exactly the sort of obvious thing a rename breaks silently.
  assert.ok(CONSTRAINT_LITERALS.includes(String(column.default)));
});

test("varchar width fits every status value", () => {
  const column = config.columns.find((c) => c.name === "status");
  const width = Number(/varchar\((\d+)\)/.exec(column!.getSQLType())?.[1]);
  assert.ok(Number.isFinite(width), "status is not a bounded varchar");
  const longest = Math.max(...orderStatusValues.map((v) => v.length));
  assert.ok(
    width >= longest,
    `varchar(${width}) cannot hold the longest status value (${longest} chars)`,
  );
});

test("insertOrderSchema rejects a status the check constraint would reject", () => {
  // drizzle-zod generates from the SQL type and ignores `$type<>`, so this only
  // holds because insertOrderSchema explicitly refines the column. If that
  // refinement is ever dropped the Zod layer silently reopens and this test is
  // the thing that notices — the constraint would still catch it, but as a
  // 500 from Postgres at INSERT time rather than a readable parse error.
  const base = {
    totalPaise: 100,
    items: [] as Array<{ id: number; name: string; qty: number; price: number }>,
  };
  assert.equal(insertOrderSchema.safeParse({ ...base, status: "confirmed" }).success, false);
  assert.equal(insertOrderSchema.safeParse({ ...base, status: "dispatched" }).success, false);
  assert.equal(insertOrderSchema.safeParse({ ...base, status: "Delivered" }).success, false);
  assert.equal(insertOrderSchema.safeParse({ ...base, status: "" }).success, false);
  for (const status of orderStatusValues) {
    assert.equal(
      insertOrderSchema.safeParse({ ...base, status }).success,
      true,
      `insertOrderSchema should accept ${status}`,
    );
  }
  // Omitting it stays legal — the column default is what fills it in. Supplying
  // a custom schema for a column makes drizzle-zod treat it as required, so the
  // `.optional()` on the refinement is what keeps every existing writer working.
  assert.equal(insertOrderSchema.safeParse(base).success, true);
});
