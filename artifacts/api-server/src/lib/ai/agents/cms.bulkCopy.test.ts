/**
 * OA-DEEP-1.6 — bulk_regenerate_copy's timeout shape.
 *
 * `regenerateCopyForTargets` is the batchProcess-based concurrency wiring
 * behind the CMS agent's `bulk_regenerate_copy` tool (see cms.ts). Before
 * this fix, the tool ran up to 25 Gemini copy-generation calls fully
 * serially inside a single agent chat turn bounded by a 30s wall-clock
 * timeout — a guaranteed timeout on any non-trivial run. This file proves
 * the wiring itself: concurrency actually happens, a permanently-failing
 * item never aborts the rest of the batch, and a rate-limited item is
 * retried (via batchProcess) rather than immediately reported as failed.
 *
 * Pure unit test — no DB, no network. The real `applyOne` (which calls
 * Gemini and writes to Postgres) is never exercised here; only the wiring
 * around it is.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/ai/agents/cms.bulkCopy.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { regenerateCopyForTargets } from "./cms";

interface FakeTarget {
  item: { slug: string };
  fields: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

test("processes targets concurrently, not serially", async () => {
  const targets: FakeTarget[] = [
    { item: { slug: "a" }, fields: ["description"] },
    { item: { slug: "b" }, fields: ["description"] },
    { item: { slug: "c" }, fields: ["description"] },
  ];
  const DELAY_MS = 200;
  const started: number[] = [];
  const start = Date.now();

  const results = await regenerateCopyForTargets(
    targets,
    async (t) => {
      started.push(Date.now() - start);
      await sleep(DELAY_MS);
      return { slug: t.item.slug, ok: true, applied: t.fields };
    },
    3, // concurrency >= target count: all three should start ~together
  );

  const wallClock = Date.now() - start;
  assert.equal(results.length, 3);
  assert.ok(
    results.every((r) => r.ok),
    "expected every target to succeed",
  );
  assert.ok(
    wallClock < DELAY_MS * 2,
    `wall clock ${wallClock}ms suggests serial execution, not concurrent (3x${DELAY_MS}ms budget)`,
  );
  const spread = Math.max(...started) - Math.min(...started);
  assert.ok(
    spread < DELAY_MS,
    `start-time spread ${spread}ms is too wide for concurrent dispatch: ${JSON.stringify(started)}`,
  );
});

test("a permanently-failing target does not abort the rest of the batch", async () => {
  const targets: FakeTarget[] = [
    { item: { slug: "good-1" }, fields: ["description"] },
    { item: { slug: "bad" }, fields: ["description"] },
    { item: { slug: "good-2" }, fields: ["description"] },
  ];

  const results = await regenerateCopyForTargets(
    targets,
    async (t) => {
      if (t.item.slug === "bad") {
        throw new Error("model returned malformed JSON");
      }
      return { slug: t.item.slug, ok: true, applied: t.fields };
    },
    3,
  );

  assert.equal(results.length, 3);
  const bySlug = new Map(results.map((r) => [r.slug, r]));
  assert.equal(bySlug.get("good-1")?.ok, true);
  assert.equal(bySlug.get("good-2")?.ok, true);
  assert.equal(bySlug.get("bad")?.ok, false);
  assert.match(bySlug.get("bad")?.error ?? "", /malformed JSON/);
});

test("the empty-draft path is a normal ok:false result, not an exception", async () => {
  // Mirrors the tool handler's own "no fields the model returned survived
  // validation" branch — applyOne returns ok:false directly rather than
  // throwing, so it must never be treated as a retryable failure.
  const targets: FakeTarget[] = [{ item: { slug: "empty" }, fields: ["description"] }];

  const results = await regenerateCopyForTargets(targets, async (t) => {
    return { slug: t.item.slug, ok: false, error: "empty draft" };
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.ok, false);
  assert.equal(results[0]?.error, "empty draft");
});

test("a rate-limited target is retried and can still succeed", async () => {
  const targets: FakeTarget[] = [{ item: { slug: "flaky" }, fields: ["description"] }];
  let attempts = 0;

  const results = await regenerateCopyForTargets(
    targets,
    async (t) => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("429 rate limit exceeded");
      }
      return { slug: t.item.slug, ok: true, applied: t.fields };
    },
    1,
    { retries: 5, minTimeout: 5, maxTimeout: 20 },
  );

  assert.equal(attempts, 3, "expected batchProcess to retry the rate-limited attempts");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.ok, true);
});
