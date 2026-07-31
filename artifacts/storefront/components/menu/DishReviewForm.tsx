"use client";
// client: the review submission form — an interactive star picker + optional
// note that POSTs to the auth-gated /dish-reviews. Only mounted when the server
// reports the signed-in user is eligible (has ordered the dish), so it never
// shows a dead form; the server re-checks eligibility, this is not the gate.
import { useState, type FormEvent } from "react";
import { submitDishReview } from "@/lib/dishReviewsApi";
import { ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

const RATING_VALUES = [1, 2, 3, 4, 5];
const MAX_BODY = 2000;

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Please sign in to leave a review.";
    if (err.status === 403) return "You can review this dish once you've ordered it.";
  }
  return "Couldn't submit your review — please try again.";
}

export function DishReviewForm({ slug, onSubmitted }: { slug: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p
        role="status"
        className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-muted"
      >
        Thanks — your review is in.
      </p>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitDishReview({ slug, rating, body: body.trim() || undefined });
      setDone(true);
      onSubmitted();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Leave a review</p>

      {/* A labelled group of toggle buttons (aria-pressed), not an ARIA
          radiogroup: without roving tabindex + arrow keys the radiogroup role
          would over-promise a keyboard pattern we don't implement. Each star is
          its own tab stop; the pressed one is the current rating. */}
      <div className="mt-2 flex items-center gap-1" role="group" aria-label="Your rating">
        {RATING_VALUES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={rating === n}
            aria-label={`Rate ${n} out of 5`}
            onClick={() => setRating(n)}
            className={`text-xl leading-none transition-transform active:scale-90 ${
              n <= rating ? "text-gold-text" : "text-ink-faint"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <label htmlFor="dish-review-body" className="sr-only">
        Your review
      </label>
      <textarea
        id="dish-review-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_BODY}
        rows={3}
        placeholder="What did you think? (optional)"
        className="mt-3 w-full rounded-2xl border border-line bg-surface-raised p-3 text-sm text-ink placeholder:text-ink-faint"
      />

      {error && (
        <p role="alert" className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={rating === 0 || submitting}
        shape="pill"
        size="fluid"
        className="mt-3 min-h-11 px-5 py-2 font-semibold disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
