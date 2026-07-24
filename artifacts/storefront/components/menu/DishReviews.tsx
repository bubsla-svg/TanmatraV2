"use client";
// client: reviews live under /dish-reviews. The GET is public, so signed-out
// visitors still see the list + rating; `eligibleToReview` (server-computed from
// the orders table) decides whether the submit form mounts. Best-effort — a
// failed or in-flight fetch renders nothing, never blocking the rest of the PDP.
import { useEffect, useState } from "react";
import {
  getDishReviews,
  resolveReviewAggregate,
  type DishReviewsResponse,
} from "@/lib/dishReviewsApi";
import { StarRating } from "./StarRating";
import { DishReviewForm } from "./DishReviewForm";

export function DishReviews({ slug }: { slug: string }) {
  const [data, setData] = useState<DishReviewsResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    getDishReviews(slug)
      .then((res) => {
        if (live) setData(res);
      })
      .catch(() => {
        // Offline / server error — leave the section out entirely (best-effort).
      });
    return () => {
      live = false;
    };
  }, [slug, reloadKey]);

  if (!data) return null;

  const { reviews, summary, eligibleToReview } = data;
  const agg = resolveReviewAggregate(data);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Reviews</h2>
        {reviews.length > 0 && agg.count > 0 && (
          <span className="flex items-center gap-2 text-sm text-ink-muted">
            <StarRating
              value={agg.average}
              label={`Rated ${agg.average} out of 5 from ${agg.count} review${agg.count > 1 ? "s" : ""}`}
            />
            <span className="tabular">
              {agg.average.toFixed(1)} · {agg.count}
            </span>
          </span>
        )}
      </div>

      {summary && (summary.mostLoved || summary.commonGripe) && (
        <dl className="mt-3 space-y-1 rounded-lg border border-line bg-surface p-3 text-sm">
          {summary.mostLoved && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-faint">Most loved</dt>
              <dd className="text-ink-muted">{summary.mostLoved}</dd>
            </div>
          )}
          {summary.commonGripe && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-faint">Common gripe</dt>
              <dd className="text-ink-muted">{summary.commonGripe}</dd>
            </div>
          )}
        </dl>
      )}

      {reviews.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          No reviews yet{eligibleToReview ? " — be the first." : "."}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">{r.reviewer.label}</span>
                <StarRating value={r.rating} />
              </div>
              {r.body && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{r.body}</p>}
              <time className="mt-1 block text-xs text-ink-faint" dateTime={r.createdAt}>
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </li>
          ))}
        </ul>
      )}

      {eligibleToReview && (
        <DishReviewForm slug={slug} onSubmitted={() => setReloadKey((k) => k + 1)} />
      )}
    </section>
  );
}
