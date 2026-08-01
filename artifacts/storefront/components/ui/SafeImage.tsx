/**
 * SafeImage — the ONE way to render a photo in this app.
 *
 * Contract, guaranteed by construction rather than by convention:
 *   - the frame (the outer element) owns the geometry: the caller gives it a
 *     locked aspect ratio or explicit box via `className`
 *     (`aspect-square w-full`, `h-16 w-16`, …) and the frame clips overflow;
 *   - the image ALWAYS fills that frame with `object-cover` — a stretched or
 *     squashed photo is unrepresentable, whatever the source dimensions are.
 *
 * This replaces the scattered raw `<img>` tags that each hand-rolled the same
 * "fixed aspect box, zero CLS" pattern and each carried its own
 * eslint-disable. The single disable lives here, with the rationale: images
 * are served unoptimized through the image proxy (see next.config), so
 * next/image's optimizer adds nothing on these routes, while the CLS and
 * cover guarantees are exactly this component's contract.
 *
 * Server component — no state, no handlers; safe to render from any RSC.
 * `priority` marks the ONE above-the-fold hero per route (eager +
 * fetchpriority=high); everything else stays lazy.
 */
export function SafeImage({
  src,
  alt = "",
  className,
  imgClassName,
  priority = false,
}: {
  src: string;
  /** Empty for decorative photos (the common case for dish shots beside
   *  their own text); pass real alt when the image carries information. */
  alt?: string;
  /** Frame classes — MUST size the box (an aspect-* or explicit h/w). */
  className?: string;
  /** Extra classes for the img itself (hover scale, transitions, …). */
  imgClassName?: string;
  priority?: boolean;
}) {
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- centralised:
          unoptimized <img> by design (see next.config); geometry is this
          component's guarantee. */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        className={`h-full w-full object-cover ${imgClassName ?? ""}`}
      />
    </span>
  );
}
