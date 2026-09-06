/**
 * Responsive candidates for the photos this app serves.
 *
 * SafeImage renders one `<img src>` at whatever width the URL happens to
 * carry, so a 64x64 avatar and a full-bleed hero download the same file. The
 * two upstreams differ in what can be done about that:
 *
 *   - `images.unsplash.com` is an imgix endpoint. `w` is a real resize
 *     parameter, and the live catalogue already pins `?w=800&q=80` on all 49
 *     dishes that use it — so a `srcSet` here is a pure win: same image,
 *     narrower file, chosen by the browser.
 *   - `/images/dishes/*.jpg` is a byte proxy through the legacy SPA
 *     (IMAGE_UPSTREAM). It resizes nothing, so any width we asked for would
 *     return the identical bytes under a lying descriptor and the browser
 *     would pick the WIDEST candidate — worse than no srcSet at all.
 *
 * Hence: candidates for the resizable host, `null` for everything else. The
 * caller is responsible for `sizes`; without it a srcSet is meaningless
 * because the browser assumes 100vw and takes the largest.
 */

/** Widths worth offering. Beyond ~1200 the source is the cap, not the layout. */
const WIDTHS = [320, 480, 640, 800, 1200] as const;

const RESIZABLE_HOST = "images.unsplash.com";

/**
 * A `srcSet` for `src`, or null when the upstream cannot resize.
 *
 * Never widens the request: candidates above the width the URL already asks
 * for are dropped, because asking imgix for 1200 when the catalogue pinned 800
 * would ship MORE bytes than today on exactly the large screens this is meant
 * to help.
 */
export function responsiveSrcSet(src: string): string | null {
  let url: URL;
  try {
    url = new URL(src, "https://placeholder.invalid");
  } catch {
    return null;
  }
  if (url.hostname !== RESIZABLE_HOST) return null;

  const declared = Number(url.searchParams.get("w"));
  const cap = Number.isFinite(declared) && declared > 0 ? declared : Infinity;
  const widths = WIDTHS.filter((w) => w <= cap);
  if (widths.length < 2) return null;

  return widths
    .map((w) => {
      const candidate = new URL(url.href);
      candidate.searchParams.set("w", String(w));
      return `${candidate.href} ${w}w`;
    })
    .join(", ");
}
