/**
 * The safe-view layer's column contract, and the Postgres rule that makes
 * editing it dangerous in a way nothing else in this repo is.
 *
 * `ensureSafeViews` builds every `safe_*` view with CREATE OR REPLACE VIEW.
 * That statement can only ADD columns, and only at the END of the list. Insert
 * one in the middle — or rename, reorder or drop one — and Postgres raises
 * 42P16 and **leaves the previous view definition exactly as it was**. Nothing
 * downstream throws. The server boots. `describeSchemaForPrompt()` starts
 * telling the analytics model about a column the database does not have, every
 * query the model writes against it fails at runtime, and until this branch the
 * log line for that failure said "skipping safe view (source missing)" — which
 * is the opposite of what happened.
 *
 * So there are two claims here and they are deliberately proved two different
 * ways:
 *
 *   structurally  SAFE_SCHEMA's column lists may only ever grow at the tail.
 *                 Asserted against a frozen prefix, DB-free, so a bad edit
 *                 fails in review rather than at the next production boot.
 *
 *   empirically   Postgres really does behave that way — including the part
 *                 that matters most, that the OLD definition survives a refused
 *                 replace. Proved against a real server on a throwaway view,
 *                 never on a real `safe_*` one.
 *
 * Needs Postgres (DATABASE_URL). Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/safeSql.schema.test.ts
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

import { pool } from "@workspace/db";

import {
  SAFE_SCHEMA,
  classifySafeViewError,
  describeSchemaForPrompt,
  ensureSafeViews,
  findSafeViewDrift,
  runSafeSql,
} from "./safeSql";

/**
 * Every safe view's column list as of the commit that added order_channel.
 *
 * This is a PREFIX, not a snapshot: the assertion below checks that each view
 * still starts with exactly this, and says nothing about what comes after. So
 * appending a column — the one edit CREATE OR REPLACE VIEW accepts — needs no
 * change here, while renaming, reordering, removing or mid-inserting one fails
 * immediately. That is the Postgres rule restated in TypeScript, which is the
 * only place it can be checked before a deploy.
 *
 * If you are here because this test failed: you almost certainly moved a column
 * rather than appended it. Move it back to the end of the list in SAFE_SCHEMA.
 * If a column genuinely must be removed or renamed, ensureSafeViews cannot do
 * it with CREATE OR REPLACE at all — that needs a DROP VIEW ... CASCADE first,
 * which is a migration, not a code edit, and this prefix shrinks in the same
 * commit.
 */
const FROZEN_PREFIX: Record<string, string[]> = {
  safe_orders: ["id", "user_id", "status", "total_paise", "city", "pincode", "items", "created_at"],
  safe_menu_items: ["slug", "name", "price_paise", "is_available", "category"],
  safe_dish_reviews: ["id", "slug", "rating", "body", "created_at"],
  safe_anomaly_alerts: ["id", "metric", "severity", "status", "value", "baseline", "summary", "created_at"],
  // Shorter than it looks: this view's declaration also named a `plan` column
  // that the subscriptions table has never had, so the view has never been
  // created anywhere and there was nothing to preserve. Everything after
  // `user_id` is new. See the note in SAFE_SCHEMA.
  safe_subscriptions: ["id", "user_id", "status"],
  safe_credit_ledger: ["id", "user_id", "delta_paise", "reason", "created_at"],
  safe_support_messages: ["id", "conversation_id", "role", "content", "created_at"],
  safe_nps_responses: ["id", "score", "comment", "created_at"],
  safe_funnel_events: ["id", "name", "session_id", "user_id", "path", "created_at"],
  safe_funnel_daily: ["day", "name", "event_count", "distinct_sessions", "distinct_users"],
};

// pg's Pool.query is overloaded past what findSafeViewDrift's structural
// parameter type will accept; this narrows it to the one shape it uses.
const poolClient = {
  query: (text: string, params?: unknown[]) =>
    pool.query(text, params as never) as Promise<{ rows: Record<string, unknown>[] }>,
};

// Unique per test-file process: `node --test` runs files concurrently against
// one database, and this probe does DDL.
const PROBE = `corv_probe_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

before(async () => {
  await pool.query(`create table ${PROBE} (a int, b int, c int)`);
});

after(async () => {
  await pool.query(`drop view if exists ${PROBE}_v`).catch(() => undefined);
  await pool.query(`drop table if exists ${PROBE}`).catch(() => undefined);
});

// ---------------------------------------------------------------------------
// The structural claim
// ---------------------------------------------------------------------------

test("no safe view's existing columns have been reordered, renamed or removed", () => {
  for (const table of SAFE_SCHEMA) {
    const frozen = FROZEN_PREFIX[table.name];
    assert.ok(
      frozen,
      `${table.name} is not in FROZEN_PREFIX — a NEW view is fine, add its column list there`,
    );
    const actual = table.columns.map((c) => c.name);
    assert.deepEqual(
      actual.slice(0, frozen.length),
      frozen,
      `${table.name}: columns may only be appended. See the header of this file.`,
    );
  }
});

test("order_channel and order_kind were appended to safe_orders, not inserted", () => {
  const cols = SAFE_SCHEMA.find((t) => t.name === "safe_orders")!.columns.map((c) => c.name);
  const frozen = FROZEN_PREFIX["safe_orders"]!;
  // The specific instance of the rule this branch created. Stated separately
  // from the general prefix test because it is the one a reader will look for.
  assert.ok(cols.includes("order_channel"), "safe_orders must expose order_channel");
  assert.ok(cols.includes("order_kind"), "safe_orders must expose order_kind");
  assert.ok(cols.indexOf("order_channel") >= frozen.length);
  assert.ok(cols.indexOf("order_kind") >= frozen.length);
});

test("the schema prompt tells the model which channel is ours", () => {
  const prompt = describeSchemaForPrompt();
  assert.match(prompt, /order_channel/);
  assert.match(prompt, /order_kind/);
  // Exposing the column is only half of it. A model that can see
  // `order_channel` but is not told that 'own_app' is the one that means our
  // customers will still write `select sum(total_paise) from safe_orders` and
  // call the answer revenue.
  assert.match(prompt, /own_app/);
  assert.match(
    describeSchemaForPrompt(),
    /safe_orders — EVERY order/,
    "the view description must say up front that it is not just our own orders",
  );
});

// ---------------------------------------------------------------------------
// classifySafeViewError — the two failures that used to log identically
// ---------------------------------------------------------------------------

test("classifySafeViewError separates the three ways a safe view fails to build", () => {
  assert.equal(classifySafeViewError({ code: "42P01" }), "source-missing");
  assert.equal(classifySafeViewError({ code: "42703" }), "column-missing");
  assert.equal(classifySafeViewError({ code: "42P16" }), "definition-refused");
  assert.equal(classifySafeViewError({ code: "42501" }), "unknown");
  assert.equal(classifySafeViewError(new Error("boom")), "unknown");
  assert.equal(classifySafeViewError(null), "unknown");
  assert.equal(classifySafeViewError(undefined), "unknown");
});

test("a column the source table does not have is its own error, not a missing source", async () => {
  // The real, shipped instance of this was safe_subscriptions naming a `plan`
  // column. Reproduced here because "the table is missing" and "the table is
  // fine and you named a column wrong" send an on-call reader to two different
  // places, and for the whole life of that view they logged the same sentence.
  let err: unknown;
  try {
    await pool.query(`create or replace view ${PROBE}_badcol_v as select a, nope from ${PROBE}`);
  } catch (e) {
    err = e;
  }
  assert.equal(classifySafeViewError(err), "column-missing");
});

// ---------------------------------------------------------------------------
// findSafeViewDrift — stubbed, so it can be asked about states the real
// database is not in without putting it in them
// ---------------------------------------------------------------------------

function stubClient(columnsByView: Record<string, string[]>) {
  return {
    query: async (_sql: string, _params?: unknown[]) => ({
      rows: Object.entries(columnsByView).flatMap(([table_name, cols]) =>
        cols.map((column_name) => ({ table_name, column_name })),
      ) as Record<string, unknown>[],
    }),
  };
}

function everyViewAsDeclared(): Record<string, string[]> {
  return Object.fromEntries(SAFE_SCHEMA.map((t) => [t.name, t.columns.map((c) => c.name)]));
}

test("findSafeViewDrift reports nothing when the database matches SAFE_SCHEMA", async () => {
  const drift = await findSafeViewDrift(stubClient(everyViewAsDeclared()));
  assert.deepEqual(drift, []);
});

test("findSafeViewDrift catches the refused-replace state: view stale, prompt ahead", async () => {
  // Exactly what a 42P16 leaves behind — safe_orders still has yesterday's
  // columns while SAFE_SCHEMA (and therefore the prompt) has today's.
  const views = everyViewAsDeclared();
  views["safe_orders"] = FROZEN_PREFIX["safe_orders"]!;
  const drift = await findSafeViewDrift(stubClient(views));
  assert.equal(drift.length, 1);
  assert.equal(drift[0]!.view, "safe_orders");
  assert.ok(drift[0]!.expected.includes("order_channel"));
  assert.ok(!drift[0]!.actual.includes("order_channel"));
});

test("findSafeViewDrift treats a differently-ordered view as drift, not as a match", async () => {
  // Same membership, different order. Harmless to read from — and a guaranteed
  // failure on the NEXT append, because Postgres compares position by position.
  // Reporting it now is the whole reason this compares order.
  const views = everyViewAsDeclared();
  const cols = [...views["safe_subscriptions"]!];
  // A true permutation — same membership, first two swapped — so this fails
  // only on ordering and cannot be passing for the trivial reason that the
  // lengths differ.
  [cols[0], cols[1]] = [cols[1]!, cols[0]!];
  views["safe_subscriptions"] = cols;
  const drift = await findSafeViewDrift(stubClient(views));
  assert.deepEqual(
    drift.map((d) => d.view),
    ["safe_subscriptions"],
  );
});

test("findSafeViewDrift reports an absent view rather than skipping it", async () => {
  const views = everyViewAsDeclared();
  delete views["safe_nps_responses"];
  const drift = await findSafeViewDrift(stubClient(views));
  assert.deepEqual(
    drift.map((d) => d.view),
    ["safe_nps_responses"],
  );
  assert.deepEqual(drift[0]!.actual, []);
});

// ---------------------------------------------------------------------------
// The empirical claim — a real server, a throwaway view
// ---------------------------------------------------------------------------

test("Postgres accepts an appended column and refuses a moved one, keeping the old view", async () => {
  await pool.query(`create or replace view ${PROBE}_v as select a, b from ${PROBE}`);

  // Appending at the tail: accepted. This is the edit SAFE_SCHEMA is allowed.
  await pool.query(`create or replace view ${PROBE}_v as select a, b, c from ${PROBE}`);
  assert.deepEqual(await probeViewColumns(), ["a", "b", "c"]);

  // Reordering: refused, with the code ensureSafeViews now branches on.
  let err: unknown;
  try {
    await pool.query(`create or replace view ${PROBE}_v as select a, c, b from ${PROBE}`);
  } catch (e) {
    err = e;
  }
  assert.ok(err, "Postgres accepted a reordered CREATE OR REPLACE VIEW — reread this file's header");
  assert.equal(classifySafeViewError(err), "definition-refused");

  // And the part that makes it dangerous rather than merely annoying: the
  // refusal is total, so the OLD definition is still serving queries. A caller
  // that swallowed the error would have no other signal that anything is wrong.
  assert.deepEqual(await probeViewColumns(), ["a", "b", "c"]);
});

test("a missing source table is a different error, and a benign one", async () => {
  let err: unknown;
  try {
    await pool.query(`create or replace view ${PROBE}_missing_v as select x from ${PROBE}_nope`);
  } catch (e) {
    err = e;
  }
  assert.equal(classifySafeViewError(err), "source-missing");
});

async function probeViewColumns(): Promise<string[]> {
  const r = await pool.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position`,
    [`${PROBE}_v`],
  );
  return r.rows.map((row: { column_name: string }) => row.column_name);
}

// ---------------------------------------------------------------------------
// End to end: the views the server actually builds
// ---------------------------------------------------------------------------

test("ensureSafeViews leaves the database matching what the prompt describes", async () => {
  await ensureSafeViews();
  const drift = await findSafeViewDrift(poolClient);
  assert.deepEqual(
    drift,
    [],
    `safe views disagree with SAFE_SCHEMA: ${JSON.stringify(drift, null, 2)}`,
  );
});

test("the analytics surface can now group revenue by channel", async () => {
  await ensureSafeViews();
  // The thing that was structurally impossible before this branch. Not an
  // assertion about the data — an assertion that the question is expressible:
  // the validator allows it, the safe role may read it, and the view has the
  // column. Any one of those three missing and "Ask the data" cannot separate
  // our revenue from a marketplace's, no matter how the question is phrased.
  const result = await runSafeSql(
    "select order_channel, order_kind, count(*) as orders, coalesce(sum(total_paise), 0) as revenue_paise from safe_orders group by 1, 2",
  );
  for (const row of result.rows) {
    assert.ok("order_channel" in row);
    assert.ok("order_kind" in row);
  }
});
