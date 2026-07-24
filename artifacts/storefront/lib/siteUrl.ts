/**
 * The canonical public origin — the single source for sitemap.ts, robots.ts,
 * the root metadataBase, and every JSON-LD `url`/`@id`. Overridable via
 * NEXT_PUBLIC_SITE_URL once a real marketing domain sits in front of the
 * service; the fallback is the current live Cloud Run origin so canonicals and
 * the sitemap are valid on deploy with zero config. Trailing slash stripped so
 * callers can safely concatenate `${SITE_URL}${path}`.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://storefront-475157072474.asia-south2.run.app"
).replace(/\/+$/, "");

/** Absolute-ise a possibly-relative asset/route path against SITE_URL. Absolute
 *  http(s) URLs (e.g. Unsplash dish photos) pass through untouched. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
