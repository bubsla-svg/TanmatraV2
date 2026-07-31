/**
 * OA-MED-1.8 — PROCESS_CACHE had no active sweep, so a one-shot user's brief
 * stayed resident for the life of the process. DB-free and network-free: this
 * exercises the Map directly.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/userBrief/cacheSweep.test.ts
 */
import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

import {
  setProcessCached,
  getProcessCached,
  sweepExpiredUserBriefs,
  _resetUserBriefCacheForTests,
  _userBriefCacheSizeForTests,
} from "./cache";
import type { UserBrief } from "./types";

const BRIEF = { userId: "u" } as unknown as UserBrief;

beforeEach(() => {
  _resetUserBriefCacheForTests();
});

test("the sweep evicts entries whose TTL has lapsed", async (t) => {
  // Freeze time so the 30s TTL is reachable without actually waiting.
  const realNow = Date.now;
  t.after(() => {
    Date.now = realNow;
  });

  let clock = 1_000_000;
  Date.now = () => clock;

  setProcessCached("user-a", undefined, BRIEF);
  setProcessCached("user-b", undefined, BRIEF);
  assert.equal(_userBriefCacheSizeForTests(), 2);

  // Still inside the 30s TTL — nothing to collect.
  clock += 10_000;
  assert.equal(sweepExpiredUserBriefs(), 0);
  assert.equal(_userBriefCacheSizeForTests(), 2);

  // Past it. This is the leak: neither user ever comes back, so before the
  // sweep existed these two entries were immortal.
  clock += 30_000;
  assert.equal(sweepExpiredUserBriefs(), 2);
  assert.equal(_userBriefCacheSizeForTests(), 0);
});

test("the sweep leaves live entries alone", async (t) => {
  const realNow = Date.now;
  t.after(() => {
    Date.now = realNow;
  });

  let clock = 2_000_000;
  Date.now = () => clock;

  setProcessCached("stale-user", undefined, BRIEF);
  clock += 25_000;
  setProcessCached("fresh-user", undefined, BRIEF);

  // +10s: stale-user is 35s old (expired), fresh-user is 10s old (live).
  clock += 10_000;
  assert.equal(sweepExpiredUserBriefs(), 1);
  assert.equal(_userBriefCacheSizeForTests(), 1);
  assert.notEqual(
    getProcessCached("fresh-user", undefined),
    null,
    "a live entry must survive the sweep",
  );
});

test("the sweep is a no-op on an empty cache", () => {
  assert.equal(sweepExpiredUserBriefs(), 0);
  assert.equal(_userBriefCacheSizeForTests(), 0);
});
