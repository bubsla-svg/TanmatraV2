/**
 * Build a responsive srcset string for Unsplash images.
 *
 * Unsplash CDN supports ?w=<px>&q=<0-100> query params for on-the-fly resizing.
 * For non-Unsplash URLs the function returns undefined so callers can omit the
 * attribute entirely rather than emit an invalid value.
 */
export function unsplashSrcset(url: string): string | undefined {
  if (!url || !url.includes("unsplash.com")) return undefined;
  try {
    const make = (w: number, q: number): string => {
      const u = new URL(url);
      u.searchParams.set("w", String(w));
      u.searchParams.set("q", String(q));
      return `${u.toString()} ${w}w`;
    };
    return [make(400, 75), make(800, 80), make(1200, 85)].join(", ");
  } catch {
    return undefined;
  }
}

/**
 * Build a responsive srcset string for local dish images.
 * Generates references to width-specific WebP, AVIF, or JPEG files.
 */
export function localDishSrcset(url: string, format: "webp" | "avif" | "jpg" = "webp"): string | undefined {
  if (!url) return undefined;
  let pathname = url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url);
      pathname = u.pathname;
    } catch {
      return undefined;
    }
  }
  
  if (!pathname.startsWith("/dishes/")) return undefined;
  
  try {
    const extIdx = pathname.lastIndexOf(".");
    if (extIdx === -1) return undefined;
    const basePath = pathname.substring(0, extIdx);
    
    const make = (w: number): string => {
      return `${basePath}-${w}.${format} ${w}w`;
    };
    return [make(200), make(400), make(800)].join(", ");
  } catch {
    return undefined;
  }
}

/**
 * Helper to fetch a smaller fallback version of the dish image
 * (defaults to 800px width fallback to prevent loading 1024px raw master).
 */
export function getLocalDishFallback(url: string, width: 200 | 400 | 800 = 800): string {
  if (!url) return url;
  let isAbsolute = false;
  let origin = "";
  let pathname = url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url);
      pathname = u.pathname;
      origin = u.origin;
      isAbsolute = true;
    } catch {
      return url;
    }
  }
  
  if (!pathname.startsWith("/dishes/")) return url;
  const extIdx = pathname.lastIndexOf(".");
  if (extIdx === -1) return url;
  const basePath = pathname.substring(0, extIdx);
  const ext = pathname.substring(extIdx);
  const newPath = `${basePath}-${width}${ext}`;
  return isAbsolute ? `${origin}${newPath}` : newPath;
}
