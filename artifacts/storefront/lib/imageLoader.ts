import type { ImageLoaderProps } from "next/image";

/**
 * next/image loader for the same-origin `/images/*` path.
 *
 * The photo library is not in this container — next.config.ts rewrites
 * `/images/:path*` to whichever host holds it (the legacy Cloud Run service
 * today, a bucket/CDN after the cutover). Next's built-in optimizer would have
 * to fetch and re-encode through that hop on every variant, so it is
 * deliberately not used; this loader emits the URL the browser should request
 * and lets the upstream decide what to do with `w`/`q`.
 *
 * The upstream ignores `w`/`q` for the base path and returns identical bytes
 * for every candidate, BUT it already publishes pre-generated derivatives
 * alongside every dish photo — `<slug>-200.jpg`, `-400.jpg`, `-800.jpg` — at
 * roughly 9x-84x smaller than the ~600KB base JPEG, and (unlike the sibling
 * .avif/.webp derivatives, which the upstream serves with a broken
 * `application/octet-stream` content-type) these carry the correct
 * `image/jpeg` type, so browsers actually decode them. A full sweep of every
 * dish slug on the live `/menu` page confirmed no dish has a working base
 * image with a broken derivative, so redirecting a requested width to its
 * nearest derivative can only shrink the payload, never break an image that
 * currently renders. Only `/images/dishes/*.jpg` is rewritten — every other
 * image path (team, recipes, challenges, marketing) has no confirmed
 * derivative and keeps the original passthrough behaviour.
 *
 * Same-origin is load-bearing: no remote host is registered here or in
 * `images.remotePatterns`, so a future `img-src 'self'` CSP stays clean.
 *
 * Pure and dependency-free — this module is bundled into both the server and
 * the client build.
 */

/** next/image's own default, restated: the loader is called with `quality`
 *  undefined whenever a call site omits the prop. */
const DEFAULT_QUALITY = 75;

const DISH_JPEG_PATTERN = /^(\/images\/dishes\/[^/?#]+)\.jpg$/;

/** Ascending — the loop below picks the first bucket that covers `width`. */
const DISH_DERIVATIVE_WIDTHS = [200, 400, 800] as const;

function dishDerivativePath(basePath: string, width: number): string {
  const bucket = DISH_DERIVATIVE_WIDTHS.find((w) => width <= w) ?? DISH_DERIVATIVE_WIDTHS[DISH_DERIVATIVE_WIDTHS.length - 1];
  return `${basePath}-${bucket}.jpg`;
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // A data: URI carries its payload in the path — a query string corrupts it.
  if (src.startsWith("data:")) return src;

  const dishMatch = DISH_JPEG_PATTERN.exec(src);
  if (dishMatch) {
    return dishDerivativePath(dishMatch[1]!, width);
  }

  // SET the params, never append a second pair. 49 live dishes carry
  // `?w=800&q=80` from the catalogue, and imgix honours the FIRST `w`: the
  // old append produced `?w=800&q=80&w=48&q=75`, which measured 104,874 bytes
  // for a 48px thumbnail — the same file as w=800 — where a clean `?w=48`
  // is 4,195 bytes (2026-09-06 audit).
  const q = quality ?? DEFAULT_QUALITY;
  try {
    const url = new URL(src, "https://placeholder.invalid");
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(q));
    return url.hostname === "placeholder.invalid" ? `${url.pathname}${url.search}` : url.href;
  } catch {
    return `${src}${src.includes("?") ? "&" : "?"}w=${width}&q=${q}`;
  }
}
