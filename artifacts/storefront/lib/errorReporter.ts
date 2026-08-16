import { API_BASE } from "./apiClient";

/**
 * Client error reporting (plan item 3.5).
 *
 * WHAT WAS BROKEN. Both recovery boundaries — `components/SegmentError.tsx` and
 * `app/global-error.tsx` — carried this:
 *
 *   if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
 *   import("@sentry/nextjs").then((S) => S.captureException(error));
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is set in no workflow, so in the deployed image both
 * return on the first line and nothing is ever reported — while the screen
 * tells the customer "the issue is on our end and we've been notified". That
 * sentence was false for every crash the storefront has ever shown.
 *
 * The second half was broken too. A `.then()` with no `.catch()` on a dynamic
 * import means a failed chunk load becomes an unhandled rejection, and the one
 * moment a chunk is most likely to fail — a flaky connection, a stale
 * deployment's hashed filenames — is the moment a boundary is rendering.
 *
 * THE SINK. `POST /api/v1/error-reports` already exists on the api-server and
 * already `logger.error`s each report, so on Cloud Run every one of these lands
 * in Cloud Logging — a durable, queryable sink that needs no vendor account and
 * no new secret. Sentry stays supported and takes precedence when a DSN is
 * configured, so adopting it later is setting an env var rather than changing
 * this file.
 *
 * NOTHING HERE CAN THROW. This runs inside an error boundary; a reporter that
 * fails loudly turns a recoverable page error into a blank screen. Every path
 * resolves, and the return value says whether a report actually went out so the
 * boundary can decide whether it is entitled to say "we've been notified".
 */

export type FetchImpl = typeof fetch;

export interface ReportableError {
  name?: string;
  message?: string;
  stack?: string;
  /** Next.js attaches this to server-component errors; it is the only handle
   *  on a production stack that was stripped before reaching the browser. */
  digest?: string;
}

/**
 * Caps, applied client-side.
 *
 * The ingestion endpoint is unauthenticated — an error beacon cannot sign in —
 * so it is worth not being the reason someone discovers that. A stack trace
 * past a few kilobytes is a recursion loop repeating one frame, and the useful
 * part is the top of it.
 */
const MAX_STACK = 4000;
const MAX_MESSAGE = 500;

function clamp(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

/** The wire body, exported so the test can assert the shape the server reads. */
export function reportBody(error: ReportableError, url: string, now: number) {
  return {
    errorName: clamp(error.name, 120) ?? "UnknownClientError",
    // The digest is appended rather than replacing the message: on a server
    // component error the message is the generic production string and the
    // digest is the ONLY way to find the real stack in the server logs.
    errorMessage:
      [clamp(error.message, MAX_MESSAGE), error.digest ? `[digest ${error.digest}]` : null]
        .filter(Boolean)
        .join(" ") || "No error message provided",
    stackTrace: clamp(error.stack, MAX_STACK),
    url,
    timestamp: new Date(now).toISOString(),
    sessionReplayTrace: [],
  };
}

/**
 * Send one report. Resolves `true` only when a sink actually accepted it.
 *
 * Never rejects and never throws — see the note above about what a throwing
 * reporter does to a boundary.
 */
export async function reportClientError(
  error: ReportableError,
  opts: { fetchImpl?: FetchImpl; url?: string; now?: number } = {},
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = opts.url ?? window.location.href;
  const now = opts.now ?? Date.now();

  // Sentry first when it is configured: it is the richer sink, and a project
  // that has paid for one should not have its errors going only to a log line.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error);
      return true;
    } catch {
      // A failed chunk load or a misconfigured DSN falls through to the
      // api-server rather than losing the report. This catch is the fix for
      // the unhandled rejection the old code produced.
    }
  }

  try {
    const res = await fetchImpl(`${API_BASE}/api/v1/error-reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // No credentials: this is a beacon, it needs no session, and sending the
      // cookie to an unauthenticated ingestion route buys nothing.
      body: JSON.stringify(reportBody(error, url, now)),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * What the boundary may say, given whether a report went out.
 *
 * Two sentences rather than one conditional clause, because the honest version
 * of "we've been notified" is not a shorter version of it — when nothing was
 * reported the customer is the only one who knows, and the useful next step is
 * to tell us.
 */
export function reportedCopy(reported: boolean): string {
  return reported
    ? "We've been notified and we're looking at it."
    : "We couldn't log this automatically — if it keeps happening, tell us and we'll chase it.";
}
