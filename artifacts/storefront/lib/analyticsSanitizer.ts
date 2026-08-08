/**
 * Analytics payload sanitizer (P0 §24 —
 * docs/architecture/privacy-analytics-contract.md). Domain invariant 16,
 * "Health Data Privacy": clinical conditions, symptoms, and allergens must
 * never reach a third-party analytics sink. Pure and DOM-free — no SDK
 * import here — so it's unit-tested without a browser or posthog-js.
 *
 * This module is the SHIPPED enforcement point. Before this file existed,
 * ANALYTICS_KEY_ALLOWLIST and sanitizeAnalyticsEvent were declared only
 * inside domainInvariants.test.ts — the rule was written down but nothing
 * enforced it against the one production analytics call
 * (components/PostHogProvider.tsx). Every analytics capture in this app must
 * route through capturePostHogEvent (or sanitizeAnalyticsEvent directly) —
 * never call an SDK's capture(...) with raw properties.
 */

/** The only properties analytics is permitted to carry. Anything else —
 *  clinical_condition, allergens, glucose_reading, employee_id, or any future
 *  clinical/PII field — is silently dropped, never forwarded. Closed by
 *  design: a new event property needs an explicit addition here, not an
 *  accidental pass-through. */
export const ANALYTICS_KEY_ALLOWLIST = new Set([
  "event_name",
  "route",
  "timestamp",
  "device_type",
  "plan_id",
  "cart_item_count",
  "checkout_step",
  "payment_provider",
]);

/** Strips every property not on the allowlist. Never throws — a malformed or
 *  unexpected payload degrades to an empty object rather than blocking the
 *  event or leaking an unreviewed field. */
export function sanitizeAnalyticsEvent(
  rawProperties: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawProperties)) {
    if (ANALYTICS_KEY_ALLOWLIST.has(k)) sanitized[k] = v;
  }
  return sanitized;
}

/**
 * The single chokepoint every analytics capture call is expected to use
 * instead of calling an SDK's capture(...) directly. `capture` is injected
 * (same pattern as this codebase's `fetchImpl` API clients) so this stays
 * SDK-free and testable with a spy instead of a real posthog-js instance.
 */
export function capturePostHogEvent(
  capture: (event: string, properties?: Record<string, unknown>) => void,
  event: string,
  rawProperties: Record<string, unknown> = {},
): void {
  capture(event, sanitizeAnalyticsEvent(rawProperties));
}
