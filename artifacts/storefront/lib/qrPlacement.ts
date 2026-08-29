/**
 * Printed-code acquisition — the pure half.
 *
 * A QR sticker is the one artefact in this product that CANNOT be redeployed.
 * Once it is on a box, a poster or a gym standee, the bytes it encodes are
 * fixed forever. Everything here exists to make that permanence survivable:
 * the printed code is a lookup key, the destination is data, and every input
 * from the outside world is treated as hostile before it reaches a redirect.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule) — these run under `node --test`
 * with no bundler to resolve the alias.
 */

/** Where a scan lands when nothing else resolved. Must agree with the
 *  api-server's own `GENERIC_LANDING` (routes/qr.ts); it is repeated rather
 *  than imported because this module must answer with no network at all. */
export const GENERIC_LANDING = "/start";

/** Query key the landing reads its placement attribution from. */
export const SRC_PARAM = "src";

/**
 * Printed codes are short, lowercase and URL-safe.
 *
 * THE CASE FOLD IS THE POINT. The QR encodes `HTTPS://TANMATRA.FOOD/Q/BOX` in
 * all caps because uppercase fits QR *alphanumeric* mode — a lower-density
 * symbol that scans smaller and from across a room, which is the difference
 * between a poster that works at 4 m and one that does not. URL paths are
 * case-SENSITIVE per RFC 3986, so `/Q/BOX` does not match `box` on its own:
 * something has to fold it deliberately, and this is that something.
 */
export function normalizeQrCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(code) ? code : null;
}

/** Referral codes are the loyalty engine's `randomBytes(4).toString("hex")`,
 *  uppercased. Folded to uppercase for the same reason as above — the printed
 *  form on a card is `/R/A1B2C3D4`. */
export function normalizeReferralCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,32}$/.test(code) ? code : null;
}

/**
 * A destination this app is willing to 302 to.
 *
 * Same-origin absolute paths ONLY. The shape being excluded is `//evil.example`
 * (and its `/\evil.example` cousin, which some browsers normalise to the same
 * thing): a protocol-relative URL that reads as a path and resolves as a
 * different HOST. Placement destinations are operator-editable rows in a table,
 * which is precisely where an open redirect gets introduced by accident rather
 * than by attack — so the guard sits at the redirect, not at the write.
 */
export function isSafeDestination(dest: string): boolean {
  return /^\/(?![/\\])[\w\-./?=&%:+]*$/.test(dest);
}

export interface LandingParams {
  /** Resolved placement code, or null when nothing resolved. */
  src?: string | null;
  /** Referral code riding along on the scan or the /r/ link. */
  ref?: string | null;
}

/**
 * The path to redirect a scan to: the placement's destination with attribution
 * attached, or the generic landing when the destination is missing or unsafe.
 *
 * Attribution is appended to whatever query the destination already declares
 * (a placement may legitimately point at `/start?goal=protein`), and an
 * existing `src`/`ref` in the destination is OVERWRITTEN — the scan we just
 * resolved is the more authoritative answer than a value typed into a config
 * row months ago.
 */
export function buildLandingPath(destination: string, params: LandingParams): string {
  const safe = isSafeDestination(destination) ? destination : GENERIC_LANDING;
  // A dummy origin: URL needs an absolute input, and only the path+query is
  // ever read back out. Nothing here can leak the placeholder host.
  const url = new URL(safe, "https://tanmatra.invalid");
  const src = params.src ? normalizeQrCode(params.src) : null;
  const ref = params.ref ? normalizeReferralCode(params.ref) : null;
  if (src) url.searchParams.set(SRC_PARAM, src);
  else url.searchParams.delete(SRC_PARAM);
  if (ref) url.searchParams.set("ref", ref);
  else url.searchParams.delete("ref");
  return `${url.pathname}${url.search}`;
}

/**
 * The lowercase canonical form of an incoming `/Q/BOX`-style path, or null when
 * it is already canonical.
 *
 * Only the two acquisition prefixes are folded, and only their FIRST segment
 * plus code. Lowercasing the whole path indiscriminately would break every
 * other route that carries a case-sensitive id (an order id, a slug), which is
 * why this is a narrow rule and not a blanket `toLowerCase()`.
 */
export function canonicalScanPath(pathname: string): string | null {
  const m = /^\/([qQrR])\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  const prefix = (m[1] ?? "").toLowerCase();
  // Percent-escapes are case-insensitive but the byte they encode is not, so
  // decode before folding and let the route handler re-validate the shape.
  let code = m[2] ?? "";
  try {
    code = decodeURIComponent(code);
  } catch {
    /* a malformed escape stays as-is; the handler's regex rejects it */
  }
  const canonical = `/${prefix}/${encodeURIComponent(code.toLowerCase())}`;
  return canonical === pathname ? null : canonical;
}
