/**
 * OA-MED-1.4 — the freshness gate that stops the 6-hourly summarizer billing
 * a Gemini call per dish whether or not anything changed. `summaryIsStale` is
 * pure, so this is DB-free and network-free.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/dishReviews.staleness.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { summaryIsStale } from "./dishReviews";

const T0 = new Date("2026-07-01T00:00:00Z");
const LATER = new Date("2026-07-02T00:00:00Z");

test("no summary yet → always generate", () => {
  assert.equal(
    summaryIsStale({ visibleCount: 5, newestReviewAt: T0, generatedAt: null, sampleSize: null }),
    true,
  );
});

test("nothing changed since the last run → skip (this is the whole saving)", () => {
  assert.equal(
    summaryIsStale({ visibleCount: 5, newestReviewAt: T0, generatedAt: LATER, sampleSize: 5 }),
    false,
  );
});

test("a review arrived after the last run → regenerate", () => {
  assert.equal(
    summaryIsStale({ visibleCount: 6, newestReviewAt: LATER, generatedAt: T0, sampleSize: 6 }),
    true,
  );
});

test("moderation: hiding a review changes the input without moving max(created_at)", () => {
  // setReviewHidden flips `hidden` and does NOT touch created_at, so the
  // newest-timestamp check alone would wrongly skip here — the summary would
  // keep quoting a review the UI no longer shows. The sampleSize comparison
  // is what catches it.
  assert.equal(
    summaryIsStale({
      visibleCount: 4, // one review was just hidden
      newestReviewAt: T0, // unchanged
      generatedAt: LATER, // summary is newer than every review
      sampleSize: 5, // but it was built from 5
    }),
    true,
  );
});

test("un-hiding a review is caught the same way", () => {
  assert.equal(
    summaryIsStale({ visibleCount: 6, newestReviewAt: T0, generatedAt: LATER, sampleSize: 5 }),
    true,
  );
});

test("ISO strings from the driver are handled, not just Date instances", () => {
  // db.execute's raw path can hand back timestamptz as strings.
  assert.equal(
    summaryIsStale({
      visibleCount: 5,
      newestReviewAt: "2026-07-02T00:00:00Z",
      generatedAt: "2026-07-01T00:00:00Z",
      sampleSize: 5,
    }),
    true,
  );
  assert.equal(
    summaryIsStale({
      visibleCount: 5,
      newestReviewAt: "2026-07-01T00:00:00Z",
      generatedAt: "2026-07-02T00:00:00Z",
      sampleSize: 5,
    }),
    false,
  );
});
