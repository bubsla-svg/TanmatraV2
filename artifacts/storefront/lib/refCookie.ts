/**
 * Ref cookie persistence helper (L-1 & L-7).
 * Parses ref/attribution query parameters (e.g. ?ref=dietitian_sharma or ?utm_source=gym_fitlife)
 * and generates cookie configs for a 30-day persistence window to power DTR hero personalization
 * and lead/checkout attribution.
 * NO "@/" alias imports permitted here per storefront lib rules.
 */

export const REF_COOKIE_NAME = "tnm_ref";
export const REF_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

/** Extract attribution code from URLSearchParams or record object. */
export function extractRefFromQuery(
  query: URLSearchParams | Record<string, string | string[] | undefined>,
): string | null {
  const getParam = (k: string): string | null => {
    if (typeof URLSearchParams !== "undefined" && query instanceof URLSearchParams) {
      return query.get(k);
    }
    const record = query as Record<string, string | string[] | undefined>;
    const val = record[k];
    return Array.isArray(val) ? (val[0] || null) : (val || null);
  };
  const ref = getParam("ref") || getParam("utm_ref");
  if (ref && typeof ref === "string" && ref.trim().length > 0) {
    return ref.trim().slice(0, 128);
  }
  return null;
}

/** Build HTTP Set-Cookie header string for manual or proxy response setting. */
export function buildRefSetCookieHeader(ref: string, secure: boolean = true): string {
  const cleanRef = encodeURIComponent(ref.trim().slice(0, 128));
  const attributes = [
    `${REF_COOKIE_NAME}=${cleanRef}`,
    `Max-Age=${REF_COOKIE_MAX_AGE_SEC}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}
