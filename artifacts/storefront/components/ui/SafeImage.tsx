import { ImgWithFallback } from "./ImgWithFallback";

/**
 * SafeImage — the ONE way to render a photo in this app.
 *
 * Contract, guaranteed by construction rather than by convention:
 *   - the frame (the outer element) owns the geometry: the caller gives it a
 *     locked aspect ratio or explicit box via `className`
 *     (`aspect-square w-full`, `h-16 w-16`, …) and the frame clips overflow;
 *   - the image ALWAYS fills that frame with `object-cover` — a stretched or
 *     squashed photo is unrepresentable, whatever the source dimensions are;
 *   - a photo that fails to load (a handful of dishes have permanently
 *     missing upstream files) degrades to a placeholder inside the SAME
 *     frame, never a broken-image icon or empty box.
 *
 * This replaces the scattered raw `<img>` tags that each hand-rolled the same
 * "fixed aspect box, zero CLS" pattern and each carried its own
 * eslint-disable. Images are served unoptimized through the image proxy (see
 * next.config), so next/image's optimizer adds nothing on these routes, while
 * the CLS and cover guarantees are exactly this component's contract.
 *
 * Still a Server Component itself — no state, no handlers, safe to render
 * from any RSC — because the onError fallback lives one level down in
 * ImgWithFallback, the one "use client" leaf this contract actually needs.
 * `priority` marks the ONE above-the-fold hero per route (eager +
 * fetchpriority=high); everything else stays lazy.
 */
export function SafeImage({
  src,
  alt = "",
  className,
  imgClassName,
  priority = false,
  fallback,
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
  /** Branded stand-in shown instead of the generic glyph when the photo
   *  fails to load (M-5 §3.5). Fills the same frame, so no layout shift. */
  fallback?: React.ReactNode;
}) {
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`}>
      <ImgWithFallback
        src={src}
        alt={alt}
        priority={priority}
        className={`h-full w-full object-cover ${imgClassName ?? ""}`}
        fallback={fallback}
      />
    </span>
  );
}
