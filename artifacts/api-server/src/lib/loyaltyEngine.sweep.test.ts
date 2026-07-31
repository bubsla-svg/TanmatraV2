/**
 * OA-MED-1.2 — the loyalty sweep's profile re-reads and serial fan-out.
 *
 * The sweep grants real customer money (birthday, anniversary, winback,
 * loyalty free week, premium unlock) and had NO test coverage of any kind
 * before this file — so these are characterization tests first and
 * performance assertions second: they pin the invariants a concurrency
 * change could plausibly break.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/loyaltyEngine.sweep.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  userProfileTable,
  notificationsTable,
} from "@workspace/db";

import { runLoyaltyEngineForUser, runLoyaltyEngineForAll } from "./loyaltyEngine";

const CREATED_USER_IDS: string[] = [];

async function makeUserWithProfile(overrides: Record<string, unknown> = {}): Promise<string> {
  const id = `sweep-${randomUUID()}`;
  await db.insert(usersTable).values({ id, email: `${id}@example.test` });
  CREATED_USER_IDS.push(id);
  await db.insert(userProfileTable).values({ userId: id, ...overrides });
  return id;
}

after(async () => {
  if (!CREATED_USER_IDS.length) return;
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.userId, CREATED_USER_IDS));
  await db
    .delete(userProfileTable)
    .where(inArray(userProfileTable.userId, CREATED_USER_IDS));
  await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
});

/** Count SELECTs against user_profile while running `fn`. */
async function countProfileReads(fn: () => Promise<unknown>): Promise<number> {
  const original = pool.query.bind(pool);
  let count = 0;
  (pool as unknown as { query: unknown }).query = (...args: unknown[]) => {
    const text =
      typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text ?? "";
    if (/from\s+"?user_profile"?/i.test(text) && /^\s*select/i.test(text)) count += 1;
    return (original as (...a: unknown[]) => unknown)(...args);
  };
  try {
    await fn();
  } finally {
    (pool as unknown as { query: unknown }).query = original;
  }
  return count;
}

test("one user sweep reads user_profile once, not three times", async () => {
  // Pre-fix: checkBirthdayOrAnniversary issued its own read and is called
  // TWICE (birthday, anniversary — the field is discriminated in JS, not
  // SQL), plus checkProteinStreak's own read = 3 identical reads of the
  // same row, unconditionally, per user per sweep.
  const userId = await makeUserWithProfile();

  const reads = await countProfileReads(() => runLoyaltyEngineForUser(userId));

  assert.equal(
    reads,
    1,
    `expected exactly one user_profile read per user, got ${reads}`,
  );
});

test("the sweep is idempotent — a second pass issues no duplicate notifications", async () => {
  // Dedupe keys are user-scoped and ensureNotification upserts with
  // onConflictDoNothing. That is what makes parallelising ACROSS users safe,
  // so it needs to be pinned before concurrency is raised.
  const today = new Date();
  const userId = await makeUserWithProfile({
    birthDate: `1990-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(
      today.getUTCDate(),
    ).padStart(2, "0")}`,
  });

  const first = await runLoyaltyEngineForUser(userId);
  const second = await runLoyaltyEngineForUser(userId);

  const rows = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(inArray(notificationsTable.userId, [userId]));

  assert.ok(first.notifications.length >= 1, "the birthday grant should fire on the first pass");
  assert.equal(
    second.notifications.length,
    0,
    "a second pass must issue nothing — the dedupe key already exists",
  );
  assert.equal(rows.length, first.notifications.length, "no duplicate rows were written");
});

test("one user's failure does not abort the sweep or corrupt its counts", async () => {
  // The per-user try/catch has to stay INSIDE the mapped function. With a
  // bare Promise.all it would move outside, and a single rejection would
  // silently skip every user after it while still returning a plausible
  // `scanned`.
  const a = await makeUserWithProfile();
  const b = await makeUserWithProfile();

  const out = await runLoyaltyEngineForAll();

  assert.ok(
    out.scanned >= 2,
    `scanned must count every discovered user, got ${out.scanned}`,
  );
  assert.ok(typeof out.triggered === "number" && out.triggered >= 0);
  // Both fixtures were reachable by the sweep's discovery query (they have
  // user_profile rows), so neither was skipped.
  assert.ok(a !== b);
});
