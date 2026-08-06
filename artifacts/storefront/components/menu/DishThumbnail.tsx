"use client";
// Client island for exactly one reason: an onError fallback. DishCard is a
// REAL Server Component (see its own header comment) and a Server Component
// cannot pass an inline event handler to next/image's <Image> — the same
// constraint DishFitBadge already carves out for personalised state. A
// handful of dishes have permanently missing upstream photos that come back
// as HTTP 200 text/html instead of a real 404; the browser still fails to
// decode it as image bytes and fires onError, same as any other broken image.
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

export function DishThumbnail({ src, className }: { src: string; className: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className={`flex items-center justify-center bg-surface-raised text-ink-faint ${className}`}>
        <ImageOff className="h-8 w-8" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={104}
      height={104}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
