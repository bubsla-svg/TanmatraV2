/**
 * Dish-reviews client: wire contract (injected fetch, no network) + the
 * pure rating aggregate. Locks: GET hits /api/dish-reviews/<encoded-slug>
 * cookie-authed with no body; POST sends the review payload; a non-2xx becomes
 * an ApiError carrying status+code; reviewAggregate averages to one decimal and
 * is empty-safe.
 * Run: node --test --import tsx ./lib/dishReviewsApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import { getDishReviews, submitDishReview, reviewAggregate, resolveReviewAggregate } from "./dishReviewsApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      credentials: init.credentials as string | undefined,
      body: init.body,
    });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

test("getDishReviews: GET /api/dish-reviews/<slug>, cookie-authed, no body", async () => {
  const calls: Call[] = [];
  const res = await getDishReviews(
    "activated-charcoal-smoothie",
    fakeFetch(calls, () => ({
      status: 200,
      body: { reviews: [], summary: null, eligibleToReview: false },
    })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "GET");
  assert.match(c.url, /\/api\/dish-reviews\/activated-charcoal-smoothie$/);
  assert.equal(c.credentials, "include");
  assert.equal(c.body, undefined);
  assert.equal(res.eligibleToReview, false);
});

test("getDishReviews: slug is URL-encoded (no path injection)", async () => {
  const calls: Call[] = [];
  await getDishReviews(
    "a b/../x",
    fakeFetch(calls, () => ({ status: 200, body: { reviews: [], summary: null, eligibleToReview: false } })),
  );
  assert.match(calls[0]!.url, /\/api\/dish-reviews\/a%20b%2F\.\.%2Fx$/);
});

test("submitDishReview: POST /api/dish-reviews with the payload", async () => {
  const calls: Call[] = [];
  const res = await submitDishReview(
    { slug: "x", rating: 5, body: "Loved it" },
    fakeFetch(calls, () => ({ status: 200, body: { review: { id: 1, slug: "x", rating: 5, body: "Loved it", photoUrl: null, createdAt: "2026-01-01T00:00:00.000Z", reviewer: { label: "Priya S.", avatarUrl: null } } } })),
  );
  const [c] = calls;
  assert.equal(c!.method, "POST");
  assert.match(c!.url, /\/api\/dish-reviews$/);
  assert.equal(c!.credentials, "include");
  assert.deepEqual(JSON.parse(String(c!.body)), { slug: "x", rating: 5, body: "Loved it" });
  assert.equal(res.review.reviewer.label, "Priya S.");
});

test("submitDishReview: 403 (not ordered) surfaces as ApiError with status+code", async () => {
  const calls: Call[] = [];
  await assert.rejects(
    submitDishReview(
      { slug: "x", rating: 4 },
      fakeFetch(calls, () => ({ status: 403, body: { error: "order this dish before leaving a review" } })),
    ),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 403);
      return true;
    },
  );
});

test("reviewAggregate: empty list → zeroed, never divides by zero", () => {
  assert.deepEqual(reviewAggregate([]), { count: 0, average: 0 });
});

test("reviewAggregate: averages to one decimal", () => {
  const agg = reviewAggregate([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);
  assert.equal(agg.count, 3);
  assert.equal(agg.average, 4.3); // 13/3 = 4.333 → 4.3
});

const DIGEST = { mostLoved: "", commonGripe: "", trend: "stable", sampleSize: 120, averageRating: 44 };

test("resolveReviewAggregate: prefers the digest's authoritative totals (beyond the 50-row cap)", () => {
  const agg = resolveReviewAggregate({
    reviews: [{ rating: 1 }] as never, // the capped list would say 1.0 / 1 — must be ignored
    summary: DIGEST,
  });
  assert.deepEqual(agg, { count: 120, average: 4.4 });
});

test("resolveReviewAggregate: falls back to the list when there's no digest", () => {
  const agg = resolveReviewAggregate({ reviews: [{ rating: 5 }, { rating: 3 }] as never, summary: null });
  assert.deepEqual(agg, { count: 2, average: 4 });
});

test("resolveReviewAggregate: a zero-sample digest falls back to the list", () => {
  const agg = resolveReviewAggregate({ reviews: [{ rating: 4 }] as never, summary: { ...DIGEST, sampleSize: 0 } });
  assert.deepEqual(agg, { count: 1, average: 4 });
});
