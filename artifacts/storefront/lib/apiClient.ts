/**
 * Transport core for the storefront api client — extracted so lib/api.ts stays
 * under the file cap. Every route is mounted under `/api`; auth is the `sid`
 * session cookie, so browser calls use `credentials:"include"`. Base URL is the
 * CLIENT-inlined `NEXT_PUBLIC_API_BASE`. The whole of @/lib/api re-exports this.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? (typeof window === "undefined" ? "http://localhost:3000" : "");

/** A non-2xx from the api-server. The server returns bare `{error, code?}` — no
 *  envelope — so we surface the status and code for the caller to branch on
 *  (e.g. 422 `plan_not_launchable` → route to waitlist). Some 422s (dish
 *  safety_block, macro_cap_exceeded) also carry a `reasons` array — kept
 *  optional since most error bodies don't have one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reasons?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type FetchImpl = typeof fetch;

/**
 * An idempotency key for a write the server must not apply twice.
 *
 * The api-server's `idempotencyMiddleware` REQUIRES an `Idempotency-Key`
 * header on the routes it guards (`app.ts:231-234`, plus inline mounts) and
 * 400s `idempotency_key_required` without one — so this is not optional
 * decoration, it is the difference between a working and a dead route.
 *
 * Pass a key that is STABLE for the logical operation, not per attempt: the
 * middleware replays the original response verbatim for a repeat of the same
 * key, which is exactly what a network-retry of a create wants. A fresh key
 * per attempt would let a retry create a second row.
 *
 * Must match the server's `/^[A-Za-z0-9._\-:]{8,128}$/`.
 */
export type IdempotencyKey = string;

/** Cookie-authed JSON request to `/api<path>`, bare-JSON in and out. `fetchImpl`
 *  is injectable so callers are testable without a network. A body (and the
 *  content-type header) is sent only when provided — GET/DELETE omit it. */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
  idempotencyKey?: IdempotencyKey,
): Promise<T> {
  const res = await fetchImpl(`${API_BASE}/api${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    ...(body !== undefined
      ? {
          headers: {
            "content-type": "application/json",
            ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
          },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON body: a Cloud Run 502/504 HTML page, a captive-portal
    // interstitial, a CDN error page. Unguarded, this threw a raw SyntaxError
    // BEFORE the res.ok branch — so every caller that branches on
    // `instanceof ApiError` (401 → inline sign-in, session-expired copy)
    // misclassified an infrastructure blip as an unknown crash. Surface it as
    // an ApiError: the real status when the server already said non-2xx, and
    // a 502 when a "successful" response carried an unparseable body.
    throw res.ok
      ? new ApiError(502, "bad_response", "Received an invalid response")
      : new ApiError(res.status, "non_json", res.statusText || "Request failed");
  }
  if (!res.ok) {
    const e = json as { error?: string; code?: string; reasons?: string[] };
    throw new ApiError(res.status, e.code ?? "error", e.error ?? res.statusText, e.reasons);
  }
  return json as T;
}

/** POST JSON to `/api<path>`. */
export function apiPost<T>(path: string, body: unknown, fetchImpl?: FetchImpl): Promise<T> {
  return apiRequest<T>("POST", path, body, fetchImpl);
}

/** POST JSON to `/api<path>` with an `Idempotency-Key`. Required by every route
 *  behind the server's `idempotencyMiddleware` — see {@link IdempotencyKey}. */
export function apiPostIdempotent<T>(
  path: string,
  body: unknown,
  idempotencyKey: IdempotencyKey,
  fetchImpl?: FetchImpl,
): Promise<T> {
  return apiRequest<T>("POST", path, body, fetchImpl, idempotencyKey);
}

/** GET `/api<path>` (no body). */
export function apiGet<T>(path: string, fetchImpl?: FetchImpl): Promise<T> {
  return apiRequest<T>("GET", path, undefined, fetchImpl);
}

/** PATCH JSON to `/api<path>`. */
export function apiPatch<T>(path: string, body: unknown, fetchImpl?: FetchImpl): Promise<T> {
  return apiRequest<T>("PATCH", path, body, fetchImpl);
}

/** PUT JSON to `/api<path>`. */
export function apiPut<T>(path: string, body: unknown, fetchImpl?: FetchImpl): Promise<T> {
  return apiRequest<T>("PUT", path, body, fetchImpl);
}

/** DELETE `/api<path>` (no body). */
export function apiDelete<T>(path: string, fetchImpl?: FetchImpl): Promise<T> {
  return apiRequest<T>("DELETE", path, undefined, fetchImpl);
}
