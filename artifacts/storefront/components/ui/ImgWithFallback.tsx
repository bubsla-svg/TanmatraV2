"use client";
// The only client-side piece of the SafeImage contract: onError can't cross
// the Server/Client boundary, so SafeImage (a Server Component, importable
// from anywhere with no "use client" cost) delegates just the <img> tag here.
//
// Some dish photos are permanently missing upstream, and the upstream
// disguises that as an HTTP 200 text/html response instead of a real 404 or
// broken image — the browser still attempts to decode it as image bytes,
// fails, and fires the same `error` event a genuine broken image would, so
// this needs no special-casing for that disguise.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";

export function ImgWithFallback({
  src,
  alt,
  className,
  priority,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  priority: boolean;
  /**
   * Branded replacement for the generic broken-image glyph (M-5 §3.5).
   * Menu surfaces pass a `DishFallbackTile`; anything that doesn't pass one
   * keeps the neutral glyph below. Not optional-by-oversight: a caller with
   * no brand-appropriate substitute genuinely should show the plain state
   * rather than borrow another surface's.
   */
  fallback?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // THE HYDRATION RACE, closed.
  //
  // `onError` is attached by React at HYDRATION. These images are
  // server-rendered, so the browser starts fetching them from the raw HTML —
  // long before the client bundle runs. A photo that fails in that window
  // has already fired its one `error` event into a tree with no listener,
  // and React never hears it: the fallback silently does not appear and the
  // customer sees the browser's own broken-image chrome. That is the exact
  // defect the fallback exists to remove, so leaving it to a race is not an
  // option — and it IS a race, which is why it looked fine intermittently.
  //
  // `complete && naturalWidth === 0` is the DOM's own record that a load
  // finished and produced no pixels, readable after the fact. Checking it on
  // mount converts "did we happen to be listening?" into a deterministic
  // answer. Runs once: post-hydration failures are handled by `onError`
  // below, which by then is genuinely attached.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, []);

  if (broken) {
    if (fallback) {
      return (
        <div role={alt ? "img" : undefined} aria-label={alt || undefined} className={className}>
          {fallback}
        </div>
      );
    }
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={`flex items-center justify-center bg-surface-raised text-ink-faint ${className}`}
      >
        <ImageOff className="h-1/4 w-1/4 min-h-6 min-w-6 max-h-10 max-w-10" aria-hidden />
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
