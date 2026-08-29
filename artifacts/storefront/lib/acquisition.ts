/**
 * Acquisition attribution — the thread that makes a printed code measurable.
 *
 * The whole point of one code per placement is being able to say "this poster
 * converts at 4%, that box sticker at 0.2%" and act on it. That sentence needs
 * FOUR counts from three different systems to line up on the same visit:
 *
 *     scan (qr_scans, written server-side by /q/[src])
 *       → pincode (funnel_events)
 *         → phone  (funnel_events)
 *           → paid (funnel_events)
 *
 * Two values do the stitching, and both are set on the redirect response so the
 * very first navigation already carries them:
 *
 *   `tnm_src`  — which placement. Read back on every later event, so a scanner
 *                who wanders to /menu and buys three screens later is still
 *                credited to the poster that started it.
 *   `tnm_fsid` — an opaque per-visit id, the join key between the scan row and
 *                the funnel rows. NOT an identity: no phone, no user id, no
 *                fingerprint, and it is regenerated whenever it expires.
 *
 * Cookies rather than sessionStorage because the scan row is written by the
 * SERVER, before any JavaScript exists to write to storage; a cookie is the
 * only value both halves can see.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */

export const SRC_COOKIE_NAME = "tnm_src";
export const FUNNEL_SESSION_COOKIE_NAME = "tnm_fsid";

/** Attribution outlives the visit — a poster scanned on Monday and acted on at
 *  the weekend is still that poster's conversion. Matches the existing
 *  `tnm_ref` window so the two attribution cookies expire together. */
export const SRC_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** The visit, not the relationship. Long enough to survive a distracted
 *  scanner finishing checkout after lunch, short enough that next week's visit
 *  is counted as a new one rather than fused onto a month-old scan. */
export const FUNNEL_SESSION_MAX_AGE_SEC = 12 * 60 * 60;

/** Same shape the placement codes are stored in — see qrPlacement.ts. */
const SRC_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const FSID_RE = /^[a-z0-9]{8,64}$/;

/** Guards the value on the way OUT of the cookie jar as well as in. A cookie is
 *  attacker-writable, and this value ends up in an analytics `props` blob and
 *  in a `qr_scans` row — validate it like any other untrusted input. */
export function isValidSrc(value: string | undefined | null): value is string {
  return typeof value === "string" && SRC_RE.test(value);
}

export function isValidFunnelSessionId(value: string | undefined | null): value is string {
  return typeof value === "string" && FSID_RE.test(value);
}

/** Opaque, non-identifying, collision-irrelevant. `crypto.randomUUID` where it
 *  exists; the fallback only has to be unique among concurrent visits. */
export function newFunnelSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.replace(
    /[^a-z0-9]/g,
    "",
  );
}

/** Reads a cookie from a raw `document.cookie` / `Cookie:` header string.
 *  Written by hand rather than pulled from a dependency so it is identical on
 *  both sides of the render boundary. */
export function readCookie(jar: string, name: string): string | undefined {
  for (const part of jar.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export interface Attribution {
  src: string | null;
  sessionId: string | null;
}

/**
 * The attribution to stamp on a funnel event, resolved from the URL first and
 * the cookie second.
 *
 * URL WINS, and that ordering is load-bearing: the redirect that lands a
 * scanner on `/start?src=gym12` also sets the cookie, but a customer who
 * scanned the box sticker last week still holds `tnm_src=box`. On this visit
 * the gym poster is what brought them, and the cookie is the stale answer.
 */
export function resolveAttribution(
  search: URLSearchParams | null,
  cookieJar: string,
): Attribution {
  const fromUrl = search?.get("src") ?? null;
  const fromCookie = readCookie(cookieJar, SRC_COOKIE_NAME) ?? null;
  const src = isValidSrc(fromUrl) ? fromUrl : isValidSrc(fromCookie) ? fromCookie : null;
  const sid = readCookie(cookieJar, FUNNEL_SESSION_COOKIE_NAME) ?? null;
  return { src, sessionId: isValidFunnelSessionId(sid) ? sid : null };
}

/** Browser-side convenience over {@link resolveAttribution}. Returns empty
 *  attribution on the server, where there is no document to read. */
export function currentAttribution(): Attribution {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { src: null, sessionId: null };
  }
  let search: URLSearchParams | null = null;
  try {
    search = new URLSearchParams(window.location.search);
  } catch {
    /* exotic URL — fall back to the cookie alone */
  }
  return resolveAttribution(search, document.cookie);
}
