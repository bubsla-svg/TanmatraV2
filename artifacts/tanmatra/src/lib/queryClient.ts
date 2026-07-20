/**
 * Shared TanStack Query client with a production-grade resilience policy.
 *
 * The customer app is used on the move — a spotty 3G train connection is the
 * norm, not the edge case — so these defaults are tuned for graceful
 * degradation over an unreliable network rather than the library's
 * one-size-fits-all `new QueryClient()`:
 *
 *  - Queries retry TRANSIENT failures (network drop, 5xx, 429 rate-limit) with
 *    capped exponential backoff, but never client errors (4xx). A 401/403/404
 *    is deterministic — retrying it three times only burns the user's data and
 *    battery and delays showing them the real error state by several seconds.
 *  - Mutations are intentionally NOT auto-retried: cart / checkout / payment
 *    calls are not all idempotent, so a blind replay risks a double order or a
 *    double charge. A mutation that is genuinely safe to replay opts in
 *    per-call via its own `retry` option.
 */
import { QueryClient } from "@tanstack/react-query";

/** Ceiling on automatic query retries for a single failed request. */
const MAX_QUERY_RETRIES = 3;
/** First backoff step; doubles each attempt up to RETRY_MAX_DELAY_MS. */
const RETRY_BASE_DELAY_MS = 1_000;
/** Hard cap so a reconnect storm never waits minutes between attempts. */
const RETRY_MAX_DELAY_MS = 15_000;
/** Too Many Requests — transient, so it is retried despite being a 4xx. */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Read the HTTP status off the generated client's `ApiError` /
 * `ResponseParseError` (both expose `status: number`). Network-layer failures
 * throw a status-less `TypeError`, so they return `undefined` and fall through
 * to the retryable path.
 */
function errorStatus(error: unknown): number | undefined {
  if (error !== null && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/** True when `status` is a deterministic client error that a retry can't fix. */
function isNonRetryableClientError(status: number | undefined): boolean {
  return (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== HTTP_TOO_MANY_REQUESTS
  );
}

/**
 * Retry predicate for queries: fail fast on 4xx, otherwise retry transient
 * failures up to MAX_QUERY_RETRIES. Exported so the policy is unit-testable
 * in isolation from React.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isNonRetryableClientError(errorStatus(error))) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/** Capped exponential backoff: 1s, 2s, 4s … never more than 15s apart. */
export function queryRetryDelayMs(attemptIndex: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** attemptIndex, RETRY_MAX_DELAY_MS);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      retryDelay: queryRetryDelayMs,
      // Returning from a tunnel / dead zone repaints stale data with fresh.
      refetchOnReconnect: true,
    },
    mutations: {
      // See the module header: no blind mutation replay on a payment path.
      retry: false,
    },
  },
});
