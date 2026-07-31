/**
 * OA-DEEP-1.6 — bulk_generate_missing_heroes's timeout shape.
 *
 * `generateHeroesForItems` is the batchProcess-based concurrency wiring
 * behind the CMS agent's `bulk_generate_missing_heroes` tool (see
 * menuAssets.ts). Before this fix, the tool ran up to 25 image generations
 * fully serially inside a single agent chat turn bounded by a 30s wall-clock
 * timeout — a guaranteed timeout on any non-trivial run. This file proves
 * the wiring itself: concurrency actually happens, a permanently-failing
 * item never aborts the rest of the batch, and a rate-limited item is
 * retried (via batchProcess) rather than immediately reported as failed.
 *
 * Pure unit test — no DB, no network. The real `generateOne` (which calls
 * Gemini) is never exercised here; only the wiring around it is.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/menuAssets.bulkHeroes.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { generateHeroesForItems } from "./menuAssets";
import type { BulkHeroResult } from "./menuAssets";

interface FakeItem {
  slug: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

test("processes items concurrently, not serially", async () => {
  const items: FakeItem[] = [
    { slug: "a" },
    { slug: "b" },
    { slug: "c" },
  ];
  const DELAY_MS = 200;
  const started: number[] = [];
  const start = Date.now();

  const results = await generateHeroesForItems(
    items,
    async (it): Promise<BulkHeroResult> => {
      started.push(Date.now() - start);
      await sleep(DELAY_MS);
      return { slug: it.slug, ok: true, assetId: 1, imageUrl: "https://x" };
    },
    3, // concurrency >= item count: all three should start ~together
  );

  const wallClock = Date.now() - start;
  assert.equal(results.length, 3);
  assert.ok(
    results.every((r) => r.ok),
    "expected every item to succeed",
  );
  // Serial would take >= 3 * DELAY_MS (~600ms); concurrent stays close to
  // one DELAY_MS. Generous margin for CI scheduling jitter.
  assert.ok(
    wallClock < DELAY_MS * 2,
    `wall clock ${wallClock}ms suggests serial execution, not concurrent (3x${DELAY_MS}ms budget)`,
  );
  // All three starts should land within a fraction of DELAY_MS of each
  // other — proof they were in flight together, not queued one after another.
  const spread = Math.max(...started) - Math.min(...started);
  assert.ok(
    spread < DELAY_MS,
    `start-time spread ${spread}ms is too wide for concurrent dispatch: ${JSON.stringify(started)}`,
  );
});

test("a permanently-failing item does not abort the rest of the batch", async () => {
  const items: FakeItem[] = [
    { slug: "good-1" },
    { slug: "bad" },
    { slug: "good-2" },
  ];

  const results = await generateHeroesForItems(
    items,
    async (it): Promise<BulkHeroResult> => {
      if (it.slug === "bad") {
        throw new Error("image generation failed: unsupported content");
      }
      return { slug: it.slug, ok: true, assetId: 1, imageUrl: "https://x" };
    },
    3,
  );

  assert.equal(results.length, 3);
  const bySlug = new Map(results.map((r) => [r.slug, r]));
  assert.equal(bySlug.get("good-1")?.ok, true);
  assert.equal(bySlug.get("good-2")?.ok, true);
  assert.equal(bySlug.get("bad")?.ok, false);
  assert.match(bySlug.get("bad")?.error ?? "", /unsupported content/);
});

test("a rate-limited item is retried and can still succeed", async () => {
  const items: FakeItem[] = [{ slug: "flaky" }];
  let attempts = 0;

  const results = await generateHeroesForItems(
    items,
    async (it): Promise<BulkHeroResult> => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("429 rate limit exceeded");
      }
      return { slug: it.slug, ok: true, assetId: 7, imageUrl: "https://x" };
    },
    1,
    { retries: 5, minTimeout: 5, maxTimeout: 20 },
  );

  assert.equal(attempts, 3, "expected batchProcess to retry the rate-limited attempts");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.ok, true);
  assert.equal(results[0]?.assetId, 7);
});
