import type { SyntheticEvent } from "react";

/**
 * Neutral "no photo" tile — a dark surface (--s2) with a muted gold plate
 * glyph, inlined as a data URI so the fallback itself can never fail to load.
 * Deliberately generic (not a fabricated dish photo): it reads as "image
 * unavailable," not as a real product shot.
 */
const FALLBACK_DISH_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
      `<rect width="200" height="200" fill="#191D20"/>` +
      `<circle cx="100" cy="100" r="46" fill="none" stroke="#F4C430" stroke-opacity="0.35" stroke-width="6"/>` +
      `<circle cx="100" cy="100" r="24" fill="none" stroke="#F4C430" stroke-opacity="0.35" stroke-width="6"/>` +
      `</svg>`,
  );

/**
 * Shared <img onError> handler for every dish / addon / recipe photo in the
 * app. Swaps a broken/unreachable src for the neutral fallback tile instead
 * of letting the browser render its native broken-image icon, and clears
 * onerror first so a bad fallback load can never loop.
 */
export function onDishImageError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.src === FALLBACK_DISH_IMAGE) return;
  img.onerror = null;
  img.src = FALLBACK_DISH_IMAGE;
}
