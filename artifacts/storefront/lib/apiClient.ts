/**
 * Transport core for the storefront api client — extracted so lib/api.ts stays
 * under the file cap. Every route is mounted under `/api`; auth is the `sid`
 * session cookie, so browser calls use `credentials:"include"`. Base URL is the
 * CLIENT-inlined `NEXT_PUBLIC_API_BASE`. The whole of @/lib/api re-exports this.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

/** A non-2xx from the api-server. The server returns bare `{error, code?}` — no
 *  envelope — so we surface the status and code for the caller to branch on
 *  (e.g. 422 `plan_not_launchable` → route to waitlist). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type FetchImpl = typeof fetch;

/** Cookie-authed JSON request to `/api<path>`, bare-JSON in and out. `fetchImpl`
 *  is injectable so callers are testable without a network. A body (and the
 *  content-type header) is sent only when provided — GET/DELETE omit it. */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const res = await fetchImpl(`${API_BASE}/api${path}`, {
    method,
    credentials: "include",
    ...(body !== undefined
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = json as { error?: string; code?: string };
    throw new ApiError(res.status, e.code ?? "error", e.error ?? res.statusText);
  }
  return json as T;
}

/** POST JSON to `/api<path>`. */
export function apiPost<T>(path: string, body: unknown, fetchImpl?: FetchImpl): Promise<T> {
  return apiRequest<T>("POST", path, body, fetchImpl);
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
