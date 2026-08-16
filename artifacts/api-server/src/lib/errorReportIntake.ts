// ─────────────────────────────────────────────────────────────────────────────
// Client-error intake — bounding what an UNAUTHENTICATED endpoint may keep.
//
// `POST /api/v1/error-reports` cannot require a session: an error beacon fires
// from a page that has just crashed, often before or without a sign-in. That is
// the right call, and it makes everything the route retains a public write.
//
// As it stood, each request appended to a module-level array that nothing ever
// drained. A loop posting a 1 MB stack trace grows the process's heap until it
// is OOM-killed — and this is the api-server, so that takes the checkout with
// it. The endpoint was also happy to store a megabyte-long field verbatim and
// then log the whole record, which turns one attacker into an unbounded log
// bill as well.
//
// So: clamp every field, and keep the retained set to a fixed-size window. The
// window exists for the ops audit view; the DURABLE record is the `logger.error`
// line the route emits, which on Cloud Run lands in Cloud Logging. That
// distinction matters — the array is a convenience, not the sink, so capping it
// loses nothing that was ever relied on.
//
// Pure and dependency-free so every bound is a unit test rather than a load test.
// ─────────────────────────────────────────────────────────────────────────────

/** Kept small deliberately: this is a debugging window, not storage. */
export const MAX_RETAINED_REPORTS = 200;

export const LIMITS = {
  errorName: 120,
  errorMessage: 1000,
  stackTrace: 8000,
  url: 2000,
  /** Replay events kept per report. A rage-click burst is the long case. */
  traceEvents: 200,
} as const;

export interface ErrorReportInput {
  errorName?: unknown;
  errorMessage?: unknown;
  stackTrace?: unknown;
  url?: unknown;
  timestamp?: unknown;
  sessionReplayTrace?: unknown;
}

export interface NormalizedReport {
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  url: string;
  timestamp: string;
  sessionReplayTrace: unknown[];
  isRageClickAlert: boolean;
  /** True when anything was cut. Surfaced so a truncated stack is never read
   *  as the whole story by whoever is debugging from it. */
  truncated: boolean;
}

function str(value: unknown, max: number): { text: string | undefined; cut: boolean } {
  if (typeof value !== "string" || value.length === 0) return { text: undefined, cut: false };
  return value.length > max
    ? { text: value.slice(0, max), cut: true }
    : { text: value, cut: false };
}

/**
 * An arriving timestamp is client-supplied and therefore not evidence of
 * anything. It is kept when it parses (a client clock is still the best record
 * of when the customer saw the crash) and replaced when it does not, so a
 * garbage string cannot make a log line unsortable.
 */
function timestamp(value: unknown, now: number): string {
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return new Date(now).toISOString();
}

export function normalizeReport(input: ErrorReportInput, now: number = Date.now()): NormalizedReport {
  const name = str(input.errorName, LIMITS.errorName);
  const message = str(input.errorMessage, LIMITS.errorMessage);
  const stack = str(input.stackTrace, LIMITS.stackTrace);
  const url = str(input.url, LIMITS.url);

  const rawTrace = Array.isArray(input.sessionReplayTrace) ? input.sessionReplayTrace : [];
  // Sliced from the END: the events just before a crash are the ones that
  // explain it, and a trace long enough to need cutting is a session where the
  // early events are the least interesting.
  const trace = rawTrace.length > LIMITS.traceEvents ? rawTrace.slice(-LIMITS.traceEvents) : rawTrace;

  return {
    errorName: name.text ?? "UnknownClientError",
    errorMessage: message.text ?? "No error message provided",
    ...(stack.text ? { stackTrace: stack.text } : {}),
    url: url.text ?? "unknown",
    timestamp: timestamp(input.timestamp, now),
    sessionReplayTrace: trace,
    isRageClickAlert: trace.some(
      (e) => typeof e === "object" && e !== null && (e as { type?: unknown }).type === "rage_click",
    ),
    truncated: name.cut || message.cut || stack.cut || url.cut || trace.length !== rawTrace.length,
  };
}

/**
 * Append to a bounded window, dropping the oldest.
 *
 * Mutates in place because the array is a module-level export other code holds
 * a reference to; returning a new one would silently orphan the audit view.
 */
export function retain<T>(window: T[], record: T, max: number = MAX_RETAINED_REPORTS): T[] {
  window.push(record);
  if (window.length > max) window.splice(0, window.length - max);
  return window;
}
