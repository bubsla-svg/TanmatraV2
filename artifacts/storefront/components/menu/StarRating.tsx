/**
 * Read-only star rating. Renders 5 glyphs filled to the nearest whole star and
 * carries the precise value in an aria-label, so screen readers hear "Rated 4.2
 * out of 5" while sighted users see the stars plus (optionally) the number
 * alongside. Pure presentational — the interactive picker lives in the review
 * form, not here.
 */
const STARS = [1, 2, 3, 4, 5];

export function StarRating({ value, label }: { value: number; label?: string }) {
  const filled = Math.round(value);
  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm leading-none"
      role="img"
      aria-label={label ?? `Rated ${value} out of 5`}
    >
      {STARS.map((n) => (
        <span key={n} aria-hidden className={n <= filled ? "text-gold" : "text-ink-faint"}>
          ★
        </span>
      ))}
    </span>
  );
}
