/**
 * Reading an HTTP status back off a thrown API error.
 *
 * The `request<T>()` helpers in this app throw `new Error(\`${status}: ${body}\`)`
 * when the server answers with a non-2xx, and let `fetch`'s own rejection
 * through untouched when the request never completed. Those two cases mean
 * opposite things on a money path:
 *
 *   • a status means THE SERVER ANSWERED and said no — a real failure;
 *   • no status means WE NEVER HEARD BACK — the operation may well have
 *     succeeded, and any payment involved probably stands.
 *
 * Telling them apart by substring is where this goes wrong. `String(err)` on an
 * Error is `"Error: 402: card declined"`, so `String(err).includes("Error")` is
 * true for absolutely everything — including the transport failure it was meant
 * to exclude — and `String(err) === "cancelled"` never matches an
 * `new Error("cancelled")` at all. Both mistakes shipped in
 * CheckoutAppointment.tsx; this module exists so the parse is written once,
 * where it can be tested, instead of re-improvised per call site.
 */

/** Narrow an unknown throwable to its message without stringifying the class. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/**
 * The HTTP status a thrown API error carries, or `null` if it carries none.
 *
 * `null` is the meaningful answer, not a failure to parse: it says the request
 * did not get an HTTP response at all (offline, DNS, CORS, aborted, suspended
 * tab). Callers on a money path should treat `null` as "unknown outcome, do not
 * tell the user it failed", and a number as an authoritative refusal.
 */
export function httpStatusOf(err: unknown): number | null {
  // Anchored: only a LEADING status counts. A 404 mentioned inside a server's
  // error body is not this request's status.
  const m = /^(\d{3})(?::|\s|$)/.exec(errorMessage(err).trim());
  if (!m) return null;
  const status = Number(m[1]);
  return status >= 100 && status <= 599 ? status : null;
}

/** True when the server answered with exactly this status. */
export function isHttpStatus(err: unknown, status: number): boolean {
  return httpStatusOf(err) === status;
}

/**
 * True when the request never reached a response — the "we don't know" case.
 *
 * Deliberately the inverse of `httpStatusOf` rather than a check for
 * TypeError/"Failed to fetch": browsers word that message differently and it is
 * localised, so matching on it is not portable.
 */
export function isTransportFailure(err: unknown): boolean {
  return httpStatusOf(err) === null;
}
