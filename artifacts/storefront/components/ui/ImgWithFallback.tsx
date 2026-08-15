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
import { useState, type ReactNode } from "react";
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
