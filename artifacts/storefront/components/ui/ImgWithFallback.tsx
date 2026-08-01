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
import { useState } from "react";
import { ImageOff } from "lucide-react";

export function ImgWithFallback({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className: string;
  priority: boolean;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
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
