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
 * Today the static upstream ignores both params and returns the same bytes for
 * every candidate — which is exactly the current behaviour, no regression —
 * while `next/image` still contributes the parts that need no resizer:
 * responsive `srcset`/`sizes`, lazy-by-default, and dimensions the component
 * cannot omit. The params go live the day the upstream is an image CDN,
 * without touching a single call site.
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

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // A data: URI carries its payload in the path — a query string corrupts it.
  if (src.startsWith("data:")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}&q=${quality ?? DEFAULT_QUALITY}`;
}
