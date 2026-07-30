"use client";
// "use client" justification: the gallery swaps the main image on thumbnail
// click — local UI state (the active index) that only exists in the browser.
// The surrounding PDP stays an RSC; only this frame is a client island.
import { useState } from "react";

/**
 * PDP image gallery: one hero frame plus a thumbnail strip when a dish has
 * companion shots. A single-image dish renders exactly the old framed image
 * with no strip, so nothing regresses for the ~majority with one photo. The
 * caller assembles + de-dupes the list via `galleryImages()`; this component
 * only presents it.
 */
export function DishGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const src = images[active] ?? images[0];

  if (!src) return null;

  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface-raised">
        <div className="aspect-[16/9] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed aspect
              box, zero CLS; see DishCard */}
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        </div>
      </div>

      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label={`${alt} photos`}>
          {images.map((image, i) => {
            const isActive = i === active;
            return (
              <li key={image} className="shrink-0">
                <button
                  type="button"
                  aria-label={`View photo ${i + 1} of ${images.length}`}
                  aria-current={isActive}
                  onClick={() => setActive(i)}
                  className={`overflow-hidden rounded-2xl border transition-transform active:scale-[0.98] ${
                    isActive ? "border-gold" : "border-line opacity-70"
                  }`}
                >
                  <span className="block h-14 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element -- fixed
                        thumbnail box; see DishCard */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
