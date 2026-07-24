/**
 * Dish-reviews client. Wraps the public catalog endpoints:
 *   GET  /dish-reviews/:slug → { reviews, summary, eligibleToReview }
 *   POST /dish-reviews       → { review }   (auth + prior order required)
 *
 * The GET is public (signed-out callers get eligibleToReview:false); the POST
 * is gated server-side against the orders table, so the client never decides
 * eligibility — it only reflects what the server reports. Kept out of
 * lib/api.ts for the file cap, mirroring dishRationaleApi.
 */
import { apiGet, apiPost, type FetchImpl } from "./apiClient";

export interface ReviewReviewer {
  /** Privacy-safe display label built server-side, e.g. "Priya S." */
  label: string;
  avatarUrl: string | null;
}

export interface DishReview {
  id: number;
  slug: string;
  /** 1–5, integer (server clamps). */
  rating: number;
  body: string;
  photoUrl: string | null;
  /** ISO timestamp (Date serialises to a string over the wire). */
  createdAt: string;
  reviewer: ReviewReviewer;
}

/**
 * AI-generated review digest (the `dish_review_summaries` row). Nullable: a dish
 * with too few reviews has no digest yet. `averageRating` is stored ×10
 * (42 → 4.2). Only the customer-facing fields are typed here; extra columns on
 * the wire (modelId, generatedAt) are ignored.
 */
export interface DishReviewDigest {
  mostLoved: string;
  commonGripe: string;
  trend: string;
  sampleSize: number;
  averageRating: number;
}

export interface DishReviewsResponse {
  reviews: DishReview[];
  summary: DishReviewDigest | null;
  eligibleToReview: boolean;
}

export function getDishReviews(
  slug: string,
  fetchImpl?: FetchImpl,
): Promise<DishReviewsResponse> {
  return apiGet(`/dish-reviews/${encodeURIComponent(slug)}`, fetchImpl);
}

export interface SubmitReviewInput {
  slug: string;
  /** 1–5. */
  rating: number;
  body?: string;
  photoUrl?: string | null;
}

export function submitDishReview(
  input: SubmitReviewInput,
  fetchImpl?: FetchImpl,
): Promise<{ review: DishReview }> {
  return apiPost("/dish-reviews", input, fetchImpl);
}

export interface ReviewAggregate {
  count: number;
  /** Mean rating to one decimal; 0 when there are no reviews. */
  average: number;
}

/**
 * Aggregate rating from the review list itself — always accurate and always
 * available, so the headline star line never depends on the (nullable) AI
 * digest row being populated.
 */
export function reviewAggregate(reviews: Pick<DishReview, "rating">[]): ReviewAggregate {
  if (reviews.length === 0) return { count: 0, average: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { count: reviews.length, average: Math.round((sum / reviews.length) * 10) / 10 };
}

/**
 * Headline aggregate for the PDP. The endpoint caps the returned list at 50, so
 * when the AI digest row exists it carries the AUTHORITATIVE totals over the
 * whole history (`sampleSize`, `averageRating` ×10) — prefer those. Only when
 * there's no digest do we fall back to computing from the returned list.
 */
export function resolveReviewAggregate(
  res: Pick<DishReviewsResponse, "reviews" | "summary">,
): ReviewAggregate {
  const { reviews, summary } = res;
  if (summary && summary.sampleSize > 0) {
    return { count: summary.sampleSize, average: Math.round(summary.averageRating) / 10 };
  }
  return reviewAggregate(reviews);
}
